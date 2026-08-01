create or replace function public.admin_link_camp_submission_to_hub_member(
  p_submission_id uuid,
  p_profile_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  submission_row public.gpe_camp_challenge_submissions%rowtype;
  profile_row public.profiles%rowtype;
  member_row public.gpe_season_members%rowtype;
  review_ids uuid[];
  created_member boolean := false;
  previous_state jsonb;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to link Camp submissions to Hub members.';
  end if;

  if p_submission_id is null or p_profile_id is null then
    raise exception 'Submission ID and Hub profile ID are required.';
  end if;

  select * into submission_row
  from public.gpe_camp_challenge_submissions
  where id = p_submission_id
  for update;

  if submission_row.id is null then
    raise exception 'Camp submission % was not found.', p_submission_id;
  end if;

  if submission_row.season_id is null then
    raise exception 'Camp submission % has no season_id and cannot be linked.', p_submission_id;
  end if;

  previous_state := jsonb_build_object(
    'submission_id', submission_row.id,
    'previous_user_id', submission_row.user_id,
    'previous_season_member_id', submission_row.season_member_id,
    'previous_neon_account_id', submission_row.neon_account_id,
    'previous_contact_email', submission_row.contact_email,
    'previous_member_link_status', submission_row.member_link_status
  );

  select * into profile_row
  from public.profiles
  where id = p_profile_id;

  if profile_row.id is null then
    raise exception 'Hub profile % was not found.', p_profile_id;
  end if;

  if not public.profile_has_active_membership(profile_row.id) then
    raise exception 'Hub profile % is not an active member. Link was not saved and no season member was created.', profile_row.id;
  end if;

  select * into member_row
  from public.gpe_season_members sm
  where sm.season_id = submission_row.season_id
    and (
      sm.user_id = profile_row.id
      or (profile_row.neon_account_id is not null and sm.neon_account_id = profile_row.neon_account_id)
      or lower(coalesce(sm.contact_email, '')) = lower(coalesce(profile_row.email, submission_row.contact_email, ''))
      or (submission_row.season_member_id is not null and sm.id = submission_row.season_member_id)
    )
  order by case
    when sm.id = submission_row.season_member_id then 1
    when sm.user_id = profile_row.id then 2
    when profile_row.neon_account_id is not null and sm.neon_account_id = profile_row.neon_account_id then 3
    else 4
  end
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
    on conflict on constraint gpe_season_members_unique_user do update
    set neon_account_id = coalesce(public.gpe_season_members.neon_account_id, excluded.neon_account_id),
        contact_email = lower(coalesce(public.gpe_season_members.contact_email, excluded.contact_email)),
        status = case
          when public.gpe_season_members.status = 'withdrawn' then public.gpe_season_members.status
          else 'active'::public.gpe_season_member_status
        end,
        updated_at = now()
    returning * into member_row;

    created_member := true;
  end if;

  if member_row.id is null then
    raise exception 'Could not create or resolve a Camp season member for profile % in season %.', profile_row.id, submission_row.season_id;
  end if;

  if member_row.status = 'withdrawn' then
    raise exception 'Resolved season member % is withdrawn. Restore season membership before linking this submission.', member_row.id;
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
      member_link_notes = coalesce(nullif(trim(p_notes), ''), 'Linked to Hub member by Team Review.'),
      updated_at = now()
  where id = submission_row.id
  returning * into submission_row;

  update public.gpe_review_submissions
  set submitted_by = profile_row.id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'campMemberLinked', true,
        'linkedProfileId', profile_row.id,
        'linkedSeasonMemberId', member_row.id
      ),
      updated_at = now()
  where source_table = 'gpe_camp_challenge_submissions'
    and source_id = submission_row.id;

  update public.constituent_leads
  set hub_profile_id = profile_row.id,
      neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
      hub_access = 'linked',
      updated_at = now()
  where lower(email_normalized) = lower(coalesce(submission_row.contact_email, profile_row.email, ''))
     or lower(email_normalized) = lower(coalesce(profile_row.email, submission_row.contact_email, ''))
     or (profile_row.neon_account_id is not null and neon_account_id = profile_row.neon_account_id);

  update public.lead_actions
  set user_id = profile_row.id,
      season_member_id = coalesce(season_member_id, member_row.id),
      hub_identity_status = 'succeeded',
      pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object('hub', 'success', 'campMemberLinked', true)
  where camp_submission_id = submission_row.id
     or exists (
       select 1
       from public.constituent_leads cl
       where cl.id = lead_actions.lead_id
         and (
           lower(cl.email_normalized) = lower(coalesce(submission_row.contact_email, profile_row.email, ''))
           or lower(cl.email_normalized) = lower(coalesce(profile_row.email, submission_row.contact_email, ''))
           or (profile_row.neon_account_id is not null and cl.neon_account_id = profile_row.neon_account_id)
         )
     );

  select array_agg(id order by created_at)
  into review_ids
  from public.gpe_review_submissions
  where source_table = 'gpe_camp_challenge_submissions'
    and source_id = submission_row.id;

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
    'camp_submission_link_hub_member',
    'user',
    profile_row.id,
    coalesce(nullif(trim(p_notes), ''), 'Link Camp submission to selected Hub member'),
    previous_state,
    jsonb_build_object(
      'submission_id', submission_row.id,
      'profile_id', profile_row.id,
      'season_id', submission_row.season_id,
      'season_member_id', member_row.id,
      'season_member_created', created_member,
      'review_submission_ids', coalesce(to_jsonb(review_ids), '[]'::jsonb),
      'member_link_status', submission_row.member_link_status
    )
  );

  return jsonb_build_object(
    'ok', true,
    'submissionId', submission_row.id,
    'profileId', profile_row.id,
    'seasonId', submission_row.season_id,
    'seasonMemberId', member_row.id,
    'seasonMemberCreated', created_member,
    'reviewSubmissionIds', coalesce(to_jsonb(review_ids), '[]'::jsonb),
    'neonAccountId', profile_row.neon_account_id,
    'email', profile_row.email,
    'memberLinkStatus', submission_row.member_link_status
  );
end;
$$;

revoke all on function public.admin_link_camp_submission_to_hub_member(uuid, uuid, text) from public, anon;
grant execute on function public.admin_link_camp_submission_to_hub_member(uuid, uuid, text) to authenticated;
