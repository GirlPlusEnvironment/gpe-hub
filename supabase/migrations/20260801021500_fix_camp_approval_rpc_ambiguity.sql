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
  member_row public.gpe_season_members%rowtype;
  reviewer uuid := auth.uid();
  points_to_award integer;
  general_transaction_id uuid;
  cabin_counts boolean := false;
  resolved_user_id uuid;
  resolved_neon_account_id text;
  resolved_season_member_id uuid;
begin
  if reviewer is null or not public.can_manage_camp(reviewer) then
    raise exception 'Not authorized to review Camp submissions.';
  end if;

  select * into action_row
  from public.gpe_camp_submission_actions
  where id = p_action_id
  for update;
  if not found then
    raise exception 'Submission action not found.';
  end if;

  select * into submission_row
  from public.gpe_camp_challenge_submissions
  where id = action_row.submission_id
  for update;
  if not found then
    raise exception 'Camp submission not found for action %.', p_action_id;
  end if;

  if action_row.challenge_id is not null then
    select * into challenge_row
    from public.gpe_challenges
    where id = action_row.challenge_id;
  end if;

  points_to_award := coalesce(p_points, action_row.requested_points, challenge_row.point_value, 0);
  if points_to_award < 0 then
    raise exception 'Points cannot be negative.';
  end if;

  resolved_user_id := submission_row.user_id;
  resolved_neon_account_id := submission_row.neon_account_id;
  resolved_season_member_id := submission_row.season_member_id;

  if resolved_user_id is null then
    select p.id, p.neon_account_id
    into resolved_user_id, resolved_neon_account_id
    from public.profiles p
    where lower(coalesce(p.email, '')) = lower(coalesce(submission_row.contact_email, ''))
       or (
         submission_row.neon_account_id is not null
         and p.neon_account_id = submission_row.neon_account_id
       )
    order by case
      when submission_row.neon_account_id is not null and p.neon_account_id = submission_row.neon_account_id then 1
      else 2
    end
    limit 1;
  end if;

  if resolved_season_member_id is null then
    select sm.id
    into resolved_season_member_id
    from public.gpe_season_members sm
    where sm.season_id = submission_row.season_id
      and (
        sm.user_id = resolved_user_id
        or (
          coalesce(resolved_neon_account_id, submission_row.neon_account_id) is not null
          and sm.neon_account_id = coalesce(resolved_neon_account_id, submission_row.neon_account_id)
        )
        or lower(coalesce(sm.contact_email, '')) = lower(coalesce(submission_row.contact_email, ''))
      )
    order by case when sm.user_id = resolved_user_id then 1 else 2 end
    limit 1;
  end if;

  if resolved_season_member_id is null then
    raise exception 'Submission is not linked to a Camp season member.';
  end if;

  select * into member_row
  from public.gpe_season_members
  where id = resolved_season_member_id
  for update;
  if not found then
    raise exception 'Camp season member not found.';
  end if;

  resolved_user_id := coalesce(resolved_user_id, member_row.user_id);
  resolved_neon_account_id := coalesce(resolved_neon_account_id, member_row.neon_account_id);
  cabin_counts := member_row.cabin_id is not null;

  update public.gpe_season_members as sm
  set user_id = coalesce(sm.user_id, resolved_user_id),
      neon_account_id = coalesce(sm.neon_account_id, resolved_neon_account_id),
      contact_email = coalesce(sm.contact_email, submission_row.contact_email),
      updated_at = now()
  where sm.id = resolved_season_member_id;

  update public.gpe_camp_challenge_submissions as s
  set user_id = coalesce(s.user_id, resolved_user_id),
      season_member_id = coalesce(s.season_member_id, resolved_season_member_id),
      neon_account_id = coalesce(s.neon_account_id, resolved_neon_account_id),
      member_link_status = case when resolved_user_id is not null then 'linked' else s.member_link_status end,
      updated_at = now()
  where s.id = submission_row.id
  returning * into submission_row;

  select id into general_transaction_id
  from public.point_transactions
  where source = 'camp_submission_action_approval'
    and source_id = p_action_id
    and points_earned > 0
  limit 1;

  if resolved_user_id is not null and points_to_award > 0 and general_transaction_id is null then
    general_transaction_id := public.award_scoped_hub_points(
      resolved_user_id,
      points_to_award,
      'camp_submission_action_approval',
      p_action_id,
      jsonb_build_object(
        'season_id', submission_row.season_id,
        'season_member_id', resolved_season_member_id,
        'submission_id', submission_row.id,
        'challenge_id', action_row.challenge_id,
        'reviewer_notes', p_notes,
        'reconciled_approval', action_row.review_status = 'approved'
      ),
      coalesce(challenge_row.slug, action_row.other_description, 'camp_submission_action'),
      submission_row.season_id,
      action_row.challenge_id,
      resolved_season_member_id,
      member_row.cabin_id,
      true,
      true,
      cabin_counts,
      'approved',
      now()
    );
  end if;

  select l.id into ledger_id
  from public.gpe_camp_points_ledger l
  where l.submission_action_id = p_action_id
    and l.entry_type = 'challenge_award'
    and l.reversed_at is null
    and l.reversed_entry_id is null
  limit 1;

  if ledger_id is null and points_to_award > 0 then
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
      general_point_transaction_id,
      counts_for_ongoing,
      counts_for_season,
      counts_for_cabin,
      cabin_id_at_award,
      approval_status,
      occurred_at
    )
    values (
      submission_row.season_id,
      resolved_season_member_id,
      resolved_user_id,
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
      jsonb_build_object(
        'reviewer_notes', p_notes,
        'general_point_transaction_id', general_transaction_id,
        'reconciled_approval', action_row.review_status = 'approved'
      ),
      general_transaction_id,
      true,
      true,
      cabin_counts,
      member_row.cabin_id,
      'approved',
      now()
    )
    returning id into ledger_id;
  elsif ledger_id is not null and general_transaction_id is not null then
    update public.gpe_camp_points_ledger as l
    set user_id = coalesce(l.user_id, resolved_user_id),
        season_member_id = coalesce(l.season_member_id, resolved_season_member_id),
        general_point_transaction_id = coalesce(l.general_point_transaction_id, general_transaction_id),
        metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
          'general_point_transaction_id', general_transaction_id,
          'reconciled_approval', true
        )
    where l.id = ledger_id;
  end if;

  update public.gpe_camp_submission_actions as a
  set
    review_status = 'approved',
    approved_points = points_to_award,
    reviewer_notes = coalesce(p_notes, a.reviewer_notes),
    reviewed_by = coalesce(a.reviewed_by, reviewer),
    reviewed_at = coalesce(a.reviewed_at, now()),
    updated_at = now()
  where a.id = p_action_id;

  update public.gpe_camp_challenge_submissions as s
  set
    review_status = 'approved',
    reviewed_by = coalesce(s.reviewed_by, reviewer),
    reviewed_at = coalesce(s.reviewed_at, now()),
    updated_at = now()
  where s.id = submission_row.id;

  perform public.upsert_review_submission_from_camp_action(p_action_id);
  perform public.emit_gpe_notification('challenge_approved', resolved_user_id, resolved_season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));
  perform public.emit_gpe_notification('points_awarded', resolved_user_id, resolved_season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));

  select lb.points, lb.rank into season_points, season_rank
  from public.gpe_camp_leaderboard lb
  where lb.season_member_id = resolved_season_member_id;

  approve_camp_submission_action.season_member_id := resolved_season_member_id;
  return next;
end;
$$;
