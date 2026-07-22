create unique index if not exists point_transactions_positive_source_unique
on public.point_transactions (source, source_id)
where source is not null
  and source_id is not null
  and points_earned > 0;

create or replace function public.award_reviewed_hub_points(
  p_user_id uuid,
  p_points integer,
  p_source text,
  p_source_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  transaction_id uuid;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to award reviewed Hub points.';
  end if;
  if p_user_id is null then
    raise exception 'Point award requires a Hub profile.';
  end if;
  if p_points = 0 then
    return null;
  end if;
  if nullif(trim(coalesce(p_source, '')), '') is null or p_source_id is null then
    raise exception 'Point award requires an idempotent source.';
  end if;

  select id into transaction_id
  from public.point_transactions
  where source = p_source
    and source_id = p_source_id
    and points_earned > 0
  limit 1;

  if transaction_id is not null and p_points > 0 then
    return transaction_id;
  end if;

  insert into public.point_transactions (
    user_id,
    points_earned,
    source,
    source_id,
    metadata
  )
  values (
    p_user_id,
    p_points,
    p_source,
    p_source_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('awarded_by', actor)
  )
  returning id into transaction_id;

  update public.profiles
  set points = greatest(0, points + p_points),
      updated_at = now()
  where id = p_user_id;

  return transaction_id;
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
    general_transaction_id := public.award_reviewed_hub_points(
      submission_row.user_id,
      points_to_award,
      'camp_submission_action_approval',
      p_action_id,
      jsonb_build_object(
        'season_id', submission_row.season_id,
        'submission_id', submission_row.id,
        'challenge_id', action_row.challenge_id,
        'reviewer_notes', p_notes
      )
    );
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

create or replace function public.add_manual_camp_point_entry(
  p_season_id uuid,
  p_season_member_id uuid,
  p_points integer,
  p_reason text
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
  actor uuid := auth.uid();
  member_row public.gpe_season_members%rowtype;
  general_transaction_id uuid;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to manage Camp points.';
  end if;
  if p_points = 0 then
    raise exception 'Manual point adjustment cannot be zero.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Manual point adjustment requires a reason.';
  end if;

  select * into member_row
  from public.gpe_season_members
  where id = p_season_member_id
    and season_id = p_season_id
  for update;
  if not found then
    raise exception 'Camp season member not found.';
  end if;

  insert into public.gpe_camp_points_ledger (
    season_id,
    season_member_id,
    user_id,
    points,
    reason,
    adjustment_type,
    entry_type,
    source,
    created_by,
    awarded_by,
    metadata
  )
  values (
    p_season_id,
    p_season_member_id,
    member_row.user_id,
    p_points,
    p_reason,
    'manual',
    case when p_points >= 0 then 'manual_adjustment'::public.gpe_point_entry_type else 'penalty'::public.gpe_point_entry_type end,
    'team_gpe_review',
    actor,
    actor,
    jsonb_build_object('manual_adjustment', true)
  )
  returning id into ledger_id;

  if member_row.user_id is not null then
    general_transaction_id := public.award_reviewed_hub_points(
      member_row.user_id,
      p_points,
      'camp_manual_point_entry',
      ledger_id,
      jsonb_build_object('season_id', p_season_id, 'season_member_id', p_season_member_id, 'reason', p_reason)
    );

    update public.gpe_camp_points_ledger
    set general_point_transaction_id = general_transaction_id,
        metadata = metadata || jsonb_build_object('general_point_transaction_id', general_transaction_id)
    where id = ledger_id;
  end if;

  perform public.emit_gpe_notification(
    'points_awarded',
    member_row.user_id,
    p_season_member_id,
    p_season_id,
    null,
    null,
    jsonb_build_object('points', p_points, 'reason', p_reason, 'source', 'manual_adjustment')
  );

  select lb.points, lb.rank into season_points, season_rank
  from public.gpe_camp_leaderboard lb
  where lb.season_member_id = p_season_member_id;

  season_member_id := p_season_member_id;
  return next;
end;
$$;

create or replace function public.approve_event_participation_claim(
  p_claim_id uuid,
  p_points integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  claim_row public.gpe_event_participation_claims%rowtype;
  resolved_user_id uuid;
  points_to_award integer;
  transaction_id uuid;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to review event participation claims.';
  end if;

  select * into claim_row
  from public.gpe_event_participation_claims
  where id = p_claim_id
  for update;
  if not found then
    raise exception 'Event participation claim not found.';
  end if;
  if claim_row.claim_status = 'awarded' then
    return jsonb_build_object('claim_id', claim_row.id, 'point_transaction_id', claim_row.point_transaction_id, 'status', 'awarded');
  end if;

  select p.id into resolved_user_id
  from public.profiles p
  where p.id = claim_row.hub_user_id
     or (claim_row.neon_account_id is not null and p.neon_account_id = claim_row.neon_account_id)
     or lower(coalesce(p.email, '')) = claim_row.email_normalized
  order by case
    when p.id = claim_row.hub_user_id then 1
    when claim_row.neon_account_id is not null and p.neon_account_id = claim_row.neon_account_id then 2
    else 3
  end
  limit 1;
  if resolved_user_id is null then
    update public.gpe_event_participation_claims
    set claim_status = 'manual_review',
        metadata = metadata || jsonb_build_object('review_notes', p_notes, 'manual_review_reason', 'No linked Hub profile'),
        reviewed_by = actor,
        reviewed_at = now()
    where id = p_claim_id;
    raise exception 'Event participation claim is not linked to a Hub profile.';
  end if;

  points_to_award := coalesce(p_points, claim_row.impact_points, 0);
  if points_to_award < 0 then
    raise exception 'Event participation points cannot be negative.';
  end if;

  if points_to_award > 0 then
    transaction_id := public.award_reviewed_hub_points(
      resolved_user_id,
      points_to_award,
      'event_participation_claim',
      p_claim_id,
      jsonb_build_object(
        'event_id', claim_row.event_id,
        'neon_event_id', claim_row.neon_event_id,
        'registration_intent_id', claim_row.registration_intent_id,
        'review_notes', p_notes
      )
    );
  end if;

  update public.gpe_event_participation_claims
  set hub_user_id = resolved_user_id,
      claim_status = 'awarded',
      impact_points = points_to_award,
      point_transaction_id = transaction_id,
      reviewed_by = actor,
      reviewed_at = now(),
      metadata = metadata || jsonb_build_object('review_notes', p_notes)
  where id = p_claim_id;

  perform public.emit_gpe_event_notification(
    'event_points_awarded',
    resolved_user_id,
    claim_row.event_id,
    claim_row.registration_intent_id,
    jsonb_build_object('points', points_to_award, 'claim_id', p_claim_id)
  );

  return jsonb_build_object('claim_id', p_claim_id, 'point_transaction_id', transaction_id, 'status', 'awarded', 'points', points_to_award);
end;
$$;

create or replace function public.sync_active_profiles_to_camp_season(
  p_season_slug text default 'camp-gpe-2026'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  season_row public.gpe_seasons%rowtype;
  linked_existing integer := 0;
  inserted_members integer := 0;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to reconcile Camp season members.';
  end if;

  select * into season_row
  from public.gpe_seasons
  where slug = p_season_slug
  limit 1;
  if not found then
    raise exception 'Camp season % not found.', p_season_slug;
  end if;

  with matched as (
    select sm.id as season_member_id, p.id as profile_id, p.neon_account_id
    from public.gpe_season_members sm
    join public.profiles p
      on p.id = sm.user_id
      or lower(coalesce(p.email, '')) = sm.contact_email
      or (sm.neon_account_id is not null and p.neon_account_id = sm.neon_account_id)
    where sm.season_id = season_row.id
      and sm.user_id is null
      and coalesce(p.membership_access_state, p.member_status) = 'active'
  ),
  updated as (
    update public.gpe_season_members sm
    set user_id = matched.profile_id,
        neon_account_id = coalesce(sm.neon_account_id, matched.neon_account_id),
        status = 'active',
        updated_at = now()
    from matched
    where sm.id = matched.season_member_id
    returning sm.id
  )
  select count(*)::integer into linked_existing from updated;

  with candidates as (
    select p.id, lower(p.email) as email, p.neon_account_id
    from public.profiles p
    where p.email is not null
      and coalesce(p.membership_access_state, p.member_status) = 'active'
      and not exists (
        select 1
        from public.gpe_season_members sm
        where sm.season_id = season_row.id
          and (sm.user_id = p.id or sm.contact_email = lower(p.email))
      )
  ),
  inserted as (
    insert into public.gpe_season_members (
      season_id,
      user_id,
      neon_account_id,
      contact_email,
      status
    )
    select season_row.id, id, neon_account_id, email, 'active'
    from candidates
    on conflict (season_id, user_id) do update set
      neon_account_id = coalesce(excluded.neon_account_id, public.gpe_season_members.neon_account_id),
      status = case when public.gpe_season_members.status = 'withdrawn' then public.gpe_season_members.status else 'active' end,
      updated_at = now()
    returning id
  )
  select count(*)::integer into inserted_members from inserted;

  return jsonb_build_object(
    'season_id', season_row.id,
    'season_slug', season_row.slug,
    'linked_existing', linked_existing,
    'inserted_members', inserted_members
  );
end;
$$;

grant execute on function public.award_reviewed_hub_points(uuid, integer, text, uuid, jsonb) to authenticated;
grant execute on function public.approve_event_participation_claim(uuid, integer, text) to authenticated;
grant execute on function public.sync_active_profiles_to_camp_season(text) to authenticated;
