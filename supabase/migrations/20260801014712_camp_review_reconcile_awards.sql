create or replace function public.upsert_review_submission_from_camp_action(p_action_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.gpe_camp_submission_actions%rowtype;
  submission_row public.gpe_camp_challenge_submissions%rowtype;
  review_id uuid;
  review_metadata jsonb;
begin
  select * into action_row
  from public.gpe_camp_submission_actions
  where id = p_action_id;
  if not found then
    raise exception 'Camp submission action not found.';
  end if;

  select * into submission_row
  from public.gpe_camp_challenge_submissions
  where id = action_row.submission_id;
  if not found then
    raise exception 'Camp submission not found.';
  end if;

  review_metadata := jsonb_build_object(
    'submission_id', submission_row.id,
    'challenge_id', action_row.challenge_id,
    'other_description', action_row.other_description,
    'proof_urls', action_row.proof_urls,
    'member_link_status', submission_row.member_link_status,
    'season_member_id', submission_row.season_member_id,
    'neon_account_id', submission_row.neon_account_id
  );

  select id into review_id
  from public.gpe_review_submissions
  where source_table = 'gpe_camp_submission_actions'
    and source_id = action_row.id
  limit 1
  for update;

  if review_id is null then
    insert into public.gpe_review_submissions (
      submission_type,
      submission_status,
      submitted_by,
      submitted_email,
      reviewed_by,
      review_notes,
      member_visible_note,
      points_awarded,
      season_id,
      source_table,
      source_id,
      metadata,
      submitted_at,
      reviewed_at
    )
    values (
      'camp',
      public.normalize_gpe_review_status(action_row.review_status::text),
      submission_row.user_id,
      submission_row.contact_email,
      action_row.reviewed_by,
      action_row.reviewer_notes,
      action_row.member_visible_note,
      coalesce(action_row.approved_points, 0),
      submission_row.season_id,
      'gpe_camp_submission_actions',
      action_row.id,
      review_metadata,
      action_row.created_at,
      action_row.reviewed_at
    )
    returning id into review_id;
  else
    update public.gpe_review_submissions
    set
      submission_status = public.normalize_gpe_review_status(action_row.review_status::text),
      submitted_by = submission_row.user_id,
      submitted_email = submission_row.contact_email,
      reviewed_by = action_row.reviewed_by,
      review_notes = action_row.reviewer_notes,
      member_visible_note = action_row.member_visible_note,
      points_awarded = coalesce(action_row.approved_points, 0),
      season_id = submission_row.season_id,
      metadata = coalesce(metadata, '{}'::jsonb) || review_metadata,
      reviewed_at = action_row.reviewed_at
    where id = review_id;
  end if;

  return review_id;
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

  update public.gpe_season_members
  set user_id = coalesce(user_id, resolved_user_id),
      neon_account_id = coalesce(neon_account_id, resolved_neon_account_id),
      contact_email = coalesce(contact_email, submission_row.contact_email),
      updated_at = now()
  where id = resolved_season_member_id;

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

  update public.gpe_camp_submission_actions
  set
    review_status = 'approved',
    approved_points = points_to_award,
    reviewer_notes = coalesce(p_notes, reviewer_notes),
    reviewed_by = coalesce(reviewed_by, reviewer),
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
  where id = p_action_id;

  update public.gpe_camp_challenge_submissions
  set
    review_status = 'approved',
    reviewed_by = coalesce(reviewed_by, reviewer),
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
  where id = submission_row.id;

  perform public.upsert_review_submission_from_camp_action(p_action_id);
  perform public.emit_gpe_notification('challenge_approved', resolved_user_id, resolved_season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));
  perform public.emit_gpe_notification('points_awarded', resolved_user_id, resolved_season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));

  select lb.points, lb.rank into season_points, season_rank
  from public.gpe_camp_leaderboard lb
  where lb.season_member_id = resolved_season_member_id;

  season_member_id := resolved_season_member_id;
  return next;
end;
$$;

create or replace function public.admin_reconcile_camp_review_award(
  p_action_id uuid,
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
  action_row public.gpe_camp_submission_actions%rowtype;
  submission_row public.gpe_camp_challenge_submissions%rowtype;
  challenge_row public.gpe_challenges%rowtype;
  profile_row public.profiles%rowtype;
  member_row public.gpe_season_members%rowtype;
  approval_row record;
  review_id uuid;
  claim_result jsonb := '{}'::jsonb;
  attach_result jsonb := '{}'::jsonb;
  general_transaction_id uuid;
  ledger_uuid uuid;
  point_event_ids uuid[];
  pending_award_ids uuid[];
  lead_action_ids uuid[];
  points_to_award integer;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to reconcile Camp review awards.';
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

  points_to_award := coalesce(p_points, action_row.approved_points, action_row.requested_points, challenge_row.point_value, 0);

  select * into profile_row
  from public.profiles p
  where p.id = submission_row.user_id
     or lower(coalesce(p.email, '')) = lower(coalesce(submission_row.contact_email, ''))
     or (
       submission_row.neon_account_id is not null
       and p.neon_account_id = submission_row.neon_account_id
     )
  order by case
    when p.id = submission_row.user_id then 1
    when submission_row.neon_account_id is not null and p.neon_account_id = submission_row.neon_account_id then 2
    else 3
  end
  limit 1;

  if profile_row.id is null then
    raise exception 'No Hub profile found for Camp submission email %.', submission_row.contact_email;
  end if;

  select * into member_row
  from public.gpe_season_members sm
  where sm.id = submission_row.season_member_id
     or (
       sm.season_id = submission_row.season_id
       and (
         sm.user_id = profile_row.id
         or (profile_row.neon_account_id is not null and sm.neon_account_id = profile_row.neon_account_id)
         or lower(coalesce(sm.contact_email, '')) = lower(coalesce(profile_row.email, submission_row.contact_email, ''))
       )
     )
  order by case when sm.id = submission_row.season_member_id then 1 when sm.user_id = profile_row.id then 2 else 3 end
  limit 1
  for update;

  if member_row.id is null then
    raise exception 'No Camp season member found for profile % in season %.', profile_row.id, submission_row.season_id;
  end if;

  update public.gpe_season_members
  set user_id = coalesce(user_id, profile_row.id),
      neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
      contact_email = coalesce(contact_email, profile_row.email, submission_row.contact_email),
      updated_at = now()
  where id = member_row.id;

  update public.gpe_camp_challenge_submissions
  set user_id = profile_row.id,
      season_member_id = member_row.id,
      neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
      member_link_status = 'linked',
      member_link_notes = coalesce(member_link_notes, 'Reconciled by Team Review recovery action.'),
      updated_at = now()
  where id = submission_row.id;

  update public.constituent_leads
  set hub_profile_id = profile_row.id,
      neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
      hub_access = 'linked',
      updated_at = now()
  where lower(email_normalized) = lower(coalesce(profile_row.email, submission_row.contact_email, ''))
     or (profile_row.neon_account_id is not null and neon_account_id = profile_row.neon_account_id);

  update public.lead_actions
  set user_id = profile_row.id,
      season_member_id = coalesce(season_member_id, member_row.id),
      hub_identity_status = 'succeeded',
      pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object('hub', 'success', 'campReviewReconciled', true)
  where camp_submission_action_id = p_action_id
     or exists (
       select 1
       from public.constituent_leads cl
       where cl.id = lead_actions.lead_id
         and (
           lower(cl.email_normalized) = lower(coalesce(profile_row.email, submission_row.contact_email, ''))
           or (profile_row.neon_account_id is not null and cl.neon_account_id = profile_row.neon_account_id)
         )
     );

  claim_result := public.service_claim_pending_point_awards_for_profile(profile_row.id);
  attach_result := public.service_attach_petition_history_to_profile(profile_row.id);

  for approval_row in
    select * from public.approve_camp_submission_action(p_action_id, points_to_award, p_notes)
  loop
    ledger_uuid := approval_row.ledger_id;
  end loop;

  review_id := public.upsert_review_submission_from_camp_action(p_action_id);

  select id into general_transaction_id
  from public.point_transactions
  where source = 'camp_submission_action_approval'
    and source_id = p_action_id
    and points_earned > 0
  limit 1;

  select array_agg(id order by created_at), array_agg(pending_award_id order by created_at)
  into point_event_ids, pending_award_ids
  from public.gpe_point_events
  where camp_submission_action_id = p_action_id
     or source_id = p_action_id;

  select array_agg(id order by occurred_at)
  into lead_action_ids
  from public.lead_actions
  where camp_submission_action_id = p_action_id;

  insert into public.moderation_audit_log (
    moderator_id,
    action,
    target_type,
    target_id,
    reason,
    previous_state,
    new_state
  )
  values (
    actor,
    'camp_review_reconcile_award',
    'user',
    profile_row.id,
    coalesce(nullif(trim(p_notes), ''), 'Reconcile Camp review and award missing points'),
    jsonb_build_object(
      'camp_submission_action_id', p_action_id,
      'previous_review_status', action_row.review_status,
      'previous_approved_points', action_row.approved_points
    ),
    jsonb_build_object(
      'profile_id', profile_row.id,
      'season_member_id', member_row.id,
      'review_submission_id', review_id,
      'point_transaction_id', general_transaction_id,
      'camp_ledger_id', ledger_uuid,
      'point_event_ids', coalesce(to_jsonb(point_event_ids), '[]'::jsonb),
      'pending_award_ids', coalesce(to_jsonb(pending_award_ids), '[]'::jsonb),
      'lead_action_ids', coalesce(to_jsonb(lead_action_ids), '[]'::jsonb),
      'claim_result', claim_result,
      'attach_result', attach_result
    )
  );

  return jsonb_build_object(
    'status', 'reconciled',
    'profileId', profile_row.id,
    'email', coalesce(profile_row.email, submission_row.contact_email),
    'neonAccountId', profile_row.neon_account_id,
    'seasonMemberId', member_row.id,
    'campSubmissionId', submission_row.id,
    'campSubmissionActionId', p_action_id,
    'reviewSubmissionId', review_id,
    'pointTransactionId', general_transaction_id,
    'campLedgerId', ledger_uuid,
    'pointEventIds', coalesce(to_jsonb(point_event_ids), '[]'::jsonb),
    'pendingAwardIds', coalesce(to_jsonb(pending_award_ids), '[]'::jsonb),
    'leadActionIds', coalesce(to_jsonb(lead_action_ids), '[]'::jsonb),
    'points', points_to_award,
    'claimResult', claim_result,
    'attachResult', attach_result
  );
end;
$$;

revoke all on function public.admin_reconcile_camp_review_award(uuid, integer, text) from public, anon;
grant execute on function public.admin_reconcile_camp_review_award(uuid, integer, text) to authenticated;
