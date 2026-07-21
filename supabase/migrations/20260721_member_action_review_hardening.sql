alter table public.point_transactions
add column if not exists source text,
add column if not exists source_id uuid,
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.gpe_camp_points_ledger
add column if not exists general_point_transaction_id uuid references public.point_transactions(id) on delete set null;

create unique index if not exists point_transactions_camp_submission_action_unique
on public.point_transactions (source, source_id)
where source = 'camp_submission_action_approval'
  and source_id is not null
  and points_earned > 0;

create or replace function public.auto_approve_camp_submission_action(p_action_id uuid)
returns table (
  ledger_id uuid,
  season_member_id uuid,
  season_points integer,
  season_rank integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Automatic Camp action approval is disabled. Use Team GPE review.';
end;
$$;

create or replace function public.approve_camp_submission_action(
  p_action_id uuid,
  p_points integer default null,
  p_notes text default null
)
returns table (
  ledger_id uuid,
  season_member_id uuid,
  season_points integer,
  season_rank integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.gpe_camp_submission_actions%rowtype;
  submission_row public.gpe_camp_challenge_submissions%rowtype;
  challenge_row public.gpe_challenges%rowtype;
  reviewer uuid := auth.uid();
  points_to_award integer;
  general_transaction_id uuid;
begin
  if reviewer is null or not public.can_manage_camp(reviewer) then
    raise exception 'Not authorized to review Camp submissions.';
  end if;

  select * into action_row from public.gpe_camp_submission_actions where id = p_action_id for update;
  if not found then
    raise exception 'Submission action not found.';
  end if;
  if action_row.review_status = 'approved' then
    raise exception 'Submission action is already approved.';
  end if;

  select * into submission_row from public.gpe_camp_challenge_submissions where id = action_row.submission_id for update;
  if submission_row.season_member_id is null then
    raise exception 'Submission is not linked to a Camp season member.';
  end if;

  if action_row.challenge_id is not null then
    select * into challenge_row from public.gpe_challenges where id = action_row.challenge_id;
  end if;

  points_to_award := coalesce(p_points, action_row.requested_points, challenge_row.point_value, 0);
  if points_to_award < 0 then
    raise exception 'Points cannot be negative.';
  end if;

  if submission_row.user_id is not null and points_to_award > 0 then
    update public.profiles
    set points = greatest(0, points + points_to_award),
        updated_at = now()
    where id = submission_row.user_id;

    insert into public.point_transactions (
      user_id,
      points_earned,
      source,
      source_id,
      metadata
    )
    values (
      submission_row.user_id,
      points_to_award,
      'camp_submission_action_approval',
      p_action_id,
      jsonb_build_object(
        'season_id', submission_row.season_id,
        'submission_id', submission_row.id,
        'challenge_id', action_row.challenge_id,
        'reviewer_id', reviewer,
        'reviewer_notes', p_notes
      )
    )
    returning id into general_transaction_id;
  end if;

  update public.gpe_camp_submission_actions
  set
    review_status = 'approved',
    approved_points = points_to_award,
    reviewer_notes = p_notes,
    reviewed_by = reviewer,
    reviewed_at = now()
  where id = p_action_id;

  insert into public.gpe_camp_points_ledger (
    season_id,
    season_member_id,
    user_id,
    submission_id,
    submission_action_id,
    challenge_id,
    points,
    reason,
    adjustment_type,
    entry_type,
    source,
    created_by,
    awarded_by,
    metadata,
    general_point_transaction_id
  )
  values (
    submission_row.season_id,
    submission_row.season_member_id,
    submission_row.user_id,
    submission_row.id,
    action_row.id,
    action_row.challenge_id,
    points_to_award,
    coalesce(challenge_row.title, action_row.other_description, 'Camp GPE challenge'),
    'award',
    'challenge_award',
    'team_gpe_review',
    reviewer,
    reviewer,
    jsonb_build_object('reviewer_notes', p_notes, 'general_point_transaction_id', general_transaction_id),
    general_transaction_id
  )
  returning id into ledger_id;

  perform public.emit_gpe_notification('challenge_approved', submission_row.user_id, submission_row.season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));
  perform public.emit_gpe_notification('points_awarded', submission_row.user_id, submission_row.season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));

  select lb.points, lb.rank into season_points, season_rank
  from public.gpe_camp_leaderboard lb
  where lb.season_member_id = submission_row.season_member_id;

  season_member_id := submission_row.season_member_id;
  return next;
end;
$$;

create or replace function public.associate_camp_submission_member(
  p_submission_id uuid,
  p_season_member_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  submission_row public.gpe_camp_challenge_submissions%rowtype;
  member_row public.gpe_season_members%rowtype;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to associate Camp submissions.';
  end if;

  select * into submission_row from public.gpe_camp_challenge_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Camp submission not found.';
  end if;

  select * into member_row
  from public.gpe_season_members
  where id = p_season_member_id
    and season_id = submission_row.season_id
  for update;
  if not found then
    raise exception 'Camp season member not found for this season.';
  end if;

  update public.gpe_camp_challenge_submissions
  set
    season_member_id = member_row.id,
    user_id = member_row.user_id,
    neon_account_id = coalesce(member_row.neon_account_id, neon_account_id),
    contact_email = member_row.contact_email,
    member_link_status = 'linked',
    member_link_notes = nullif(trim(coalesce(p_notes, '')), ''),
    reviewed_by = actor,
    reviewed_at = now()
  where id = p_submission_id;
end;
$$;

create or replace function public.update_camp_submission_action_review(
  p_action_id uuid,
  p_challenge_id uuid default null,
  p_other_description text default null,
  p_requested_points integer default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  action_row public.gpe_camp_submission_actions%rowtype;
  challenge_row public.gpe_challenges%rowtype;
  next_challenge_id uuid;
  next_description text;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to edit Camp submission reviews.';
  end if;

  select * into action_row from public.gpe_camp_submission_actions where id = p_action_id for update;
  if not found then
    raise exception 'Submission action not found.';
  end if;
  if action_row.review_status = 'approved' then
    raise exception 'Reopen this submission action before changing reviewed details.';
  end if;

  if p_challenge_id is not null then
    select * into challenge_row from public.gpe_challenges where id = p_challenge_id;
    if not found then
      raise exception 'Camp challenge not found.';
    end if;
  end if;

  next_challenge_id := coalesce(p_challenge_id, action_row.challenge_id);
  next_description := coalesce(nullif(trim(coalesce(p_other_description, '')), ''), action_row.other_description);
  if next_challenge_id is null and nullif(trim(coalesce(next_description, '')), '') is null then
    raise exception 'Submission action needs a challenge or description.';
  end if;

  update public.gpe_camp_submission_actions
  set
    challenge_id = next_challenge_id,
    action_type_id = case when p_challenge_id is not null then challenge_row.action_type_id else action_type_id end,
    other_description = next_description,
    requested_points = coalesce(p_requested_points, requested_points, challenge_row.point_value),
    reviewer_notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), reviewer_notes),
    reviewed_by = actor,
    reviewed_at = now()
  where id = p_action_id;
end;
$$;

create or replace function public.reopen_camp_submission_action(
  p_action_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  action_row public.gpe_camp_submission_actions%rowtype;
  ledger_row public.gpe_camp_points_ledger%rowtype;
  reversal_general_transaction_id uuid;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to reopen Camp submission reviews.';
  end if;

  select * into action_row from public.gpe_camp_submission_actions where id = p_action_id for update;
  if not found then
    raise exception 'Submission action not found.';
  end if;

  for ledger_row in
    select *
    from public.gpe_camp_points_ledger
    where submission_action_id = p_action_id
      and entry_type = 'challenge_award'
      and reversed_at is null
      and reversed_entry_id is null
    for update
  loop
    reversal_general_transaction_id := null;

    if ledger_row.user_id is not null and ledger_row.points <> 0 then
      update public.profiles
      set points = greatest(0, points - ledger_row.points),
          updated_at = now()
      where id = ledger_row.user_id;

      insert into public.point_transactions (
        user_id,
        points_earned,
        source,
        source_id,
        metadata
      )
      values (
        ledger_row.user_id,
        -ledger_row.points,
        'camp_submission_action_reopen',
        ledger_row.id,
        jsonb_build_object('submission_action_id', p_action_id, 'reviewer_id', actor, 'reason', p_notes)
      )
      returning id into reversal_general_transaction_id;
    end if;

    update public.gpe_camp_points_ledger
    set reversed_by = actor,
        reversed_at = now(),
        reversal_reason = coalesce(nullif(trim(coalesce(p_notes, '')), ''), 'Reopened for review')
    where id = ledger_row.id;

    insert into public.gpe_camp_points_ledger (
      season_id,
      season_member_id,
      user_id,
      submission_id,
      submission_action_id,
      challenge_id,
      points,
      reason,
      adjustment_type,
      entry_type,
      source,
      created_by,
      awarded_by,
      reversed_entry_id,
      metadata,
      general_point_transaction_id
    )
    values (
      ledger_row.season_id,
      ledger_row.season_member_id,
      ledger_row.user_id,
      ledger_row.submission_id,
      ledger_row.submission_action_id,
      ledger_row.challenge_id,
      -ledger_row.points,
      coalesce(nullif(trim(coalesce(p_notes, '')), ''), 'Reopened for review'),
      'reversal',
      'reversal',
      'team_gpe_review',
      actor,
      actor,
      ledger_row.id,
      jsonb_build_object('reopened', true),
      reversal_general_transaction_id
    );
  end loop;

  update public.gpe_camp_submission_actions
  set
    review_status = 'pending',
    approved_points = null,
    reviewer_notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), reviewer_notes),
    reviewed_by = actor,
    reviewed_at = now()
  where id = p_action_id;
end;
$$;

update public.gpe_challenges
set
  instructions = replace(instructions, 'Action Network submissions can be imported automatically for Camp points.', 'Action Network completions are saved for Team GPE review before points are awarded.'),
  action_url = case slug
    when 'sign-high-energy-bills-petition' then 'https://www.girlplusenvironment.org/high-energy-bills-action'
    when 'stop-coal-slush-fund-petition' then 'https://www.girlplusenvironment.org/coal-slush-fund-action'
    else action_url
  end,
  auto_approve = false,
  requires_review = true
where slug in ('sign-high-energy-bills-petition', 'stop-coal-slush-fund-petition');

grant execute on function public.auto_approve_camp_submission_action(uuid) to authenticated;
grant execute on function public.approve_camp_submission_action(uuid, integer, text) to authenticated;
grant execute on function public.associate_camp_submission_member(uuid, uuid, text) to authenticated;
grant execute on function public.update_camp_submission_action_review(uuid, uuid, text, integer, text) to authenticated;
grant execute on function public.reopen_camp_submission_action(uuid, text) to authenticated;
