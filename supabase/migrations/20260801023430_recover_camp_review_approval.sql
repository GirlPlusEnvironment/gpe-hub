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
  season_member_created boolean := false;
  already_awarded boolean := false;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to reconcile Camp review awards.';
  end if;

  select * into action_row
  from public.gpe_camp_submission_actions
  where id = p_action_id
  for update;
  if not found then
    raise exception 'Submission action not found for action %. Check the selected review row and Camp action relationship.', p_action_id;
  end if;

  select * into submission_row
  from public.gpe_camp_challenge_submissions
  where id = action_row.submission_id
  for update;
  if not found then
    raise exception 'Camp submission not found for action %. Check gpe_camp_submission_actions.submission_id.', p_action_id;
  end if;

  if action_row.challenge_id is not null then
    select * into challenge_row
    from public.gpe_challenges
    where id = action_row.challenge_id;
  end if;

  points_to_award := coalesce(p_points, action_row.approved_points, action_row.requested_points, challenge_row.point_value, 0);
  if points_to_award < 0 then
    raise exception 'Points cannot be negative.';
  end if;

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
    raise exception 'No Hub profile found for Camp submission email %. Reconcile the submission to a Hub profile before approving.', submission_row.contact_email;
  end if;

  if not public.profile_has_active_membership(profile_row.id) then
    raise exception 'Hub profile % is not an active member. Camp review recovery will not create a season member or award points.', profile_row.id;
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
    insert into public.gpe_season_members (
      season_id,
      user_id,
      neon_account_id,
      contact_email,
      status
    )
    values (
      submission_row.season_id,
      profile_row.id,
      profile_row.neon_account_id,
      lower(coalesce(profile_row.email, submission_row.contact_email)),
      'active'
    )
    on conflict on constraint gpe_season_members_unique_email do update
    set user_id = coalesce(public.gpe_season_members.user_id, excluded.user_id),
        neon_account_id = coalesce(public.gpe_season_members.neon_account_id, excluded.neon_account_id),
        status = case
          when public.gpe_season_members.status = 'withdrawn' then public.gpe_season_members.status
          else 'active'::public.gpe_season_member_status
        end,
        updated_at = now()
    returning * into member_row;

    season_member_created := true;
  end if;

  if member_row.id is null then
    raise exception 'No Camp season member found or created for profile % in season %.', profile_row.id, submission_row.season_id;
  end if;

  update public.gpe_season_members
  set user_id = coalesce(user_id, profile_row.id),
      neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
      contact_email = lower(coalesce(contact_email, profile_row.email, submission_row.contact_email)),
      status = case when status = 'withdrawn' then status else 'active'::public.gpe_season_member_status end,
      updated_at = now()
  where id = member_row.id
  returning * into member_row;

  update public.gpe_camp_challenge_submissions
  set user_id = profile_row.id,
      season_member_id = member_row.id,
      neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
      member_link_status = 'linked',
      member_link_notes = coalesce(member_link_notes, 'Reconciled by Team Review recovery action.'),
      updated_at = now()
  where id = submission_row.id
  returning * into submission_row;

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

  select id into general_transaction_id
  from public.point_transactions
  where source = 'camp_submission_action_approval'
    and source_id = p_action_id
    and points_earned > 0
  limit 1;

  select id into ledger_uuid
  from public.gpe_camp_points_ledger
  where submission_action_id = p_action_id
    and entry_type = 'challenge_award'
    and reversed_at is null
    and reversed_entry_id is null
  limit 1;

  already_awarded := general_transaction_id is not null or ledger_uuid is not null;

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

  select id into ledger_uuid
  from public.gpe_camp_points_ledger
  where submission_action_id = p_action_id
    and entry_type = 'challenge_award'
    and reversed_at is null
    and reversed_entry_id is null
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
      'ok', true,
      'season_member_created', season_member_created,
      'already_awarded', already_awarded,
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
    'ok', true,
    'status', 'reconciled',
    'seasonMemberCreated', season_member_created,
    'alreadyAwarded', already_awarded,
    'profileId', profile_row.id,
    'email', coalesce(profile_row.email, submission_row.contact_email),
    'neonAccountId', profile_row.neon_account_id,
    'seasonMemberId', member_row.id,
    'campSubmissionId', submission_row.id,
    'campSubmissionActionId', p_action_id,
    'reviewSubmissionId', review_id,
    'transactionId', general_transaction_id,
    'pointTransactionId', general_transaction_id,
    'ledgerId', ledger_uuid,
    'campLedgerId', ledger_uuid,
    'pointEventIds', coalesce(to_jsonb(point_event_ids), '[]'::jsonb),
    'pendingAwardIds', coalesce(to_jsonb(pending_award_ids), '[]'::jsonb),
    'leadActionIds', coalesce(to_jsonb(lead_action_ids), '[]'::jsonb),
    'pointsAwarded', case when already_awarded then 0 else points_to_award end,
    'points', points_to_award,
    'claimResult', claim_result,
    'attachResult', attach_result
  );
end;
$$;

revoke all on function public.admin_reconcile_camp_review_award(uuid, integer, text) from public, anon;
grant execute on function public.admin_reconcile_camp_review_award(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
