create or replace function public.service_claim_pending_point_awards_for_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  event_row public.gpe_point_events%rowtype;
  lead_row public.constituent_leads%rowtype;
  result jsonb;
  claimed_count integer := 0;
  awarded_total integer := 0;
  pending_total integer := 0;
  duplicate_count integer := 0;
  resolved_season_member_id uuid;
  result_status text;
  result_points_status public.gpe_action_points_status;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  select * into profile_row
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Profile not found.';
  end if;

  update public.constituent_leads
  set
    hub_profile_id = p_profile_id,
    neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id),
    hub_access = 'linked'
  where lower(email_normalized) = lower(coalesce(profile_row.email, ''))
     or (profile_row.neon_account_id is not null and neon_account_id = profile_row.neon_account_id);

  for event_row in
    select distinct pe.*
    from public.gpe_point_events pe
    left join public.constituent_leads cl on cl.id = pe.lead_id
    left join public.gpe_pending_point_awards pending on pending.point_event_id = pe.id
    where pe.event_type not in ('PETITION_SUBMITTED', 'CAMP_PETITION_COMPLETED', 'CAMP_PETITION_CHALLENGE')
      and (
        pe.points_status = 'pending_identity'
        or pe.user_id is null
        or pending.status = 'pending'
      )
      and (
        pe.user_id = p_profile_id
        or lower(coalesce(pe.email_normalized, '')) = lower(coalesce(profile_row.email, ''))
        or lower(coalesce(pending.email_normalized, '')) = lower(coalesce(profile_row.email, ''))
        or lower(coalesce(cl.email_normalized, '')) = lower(coalesce(profile_row.email, ''))
        or (
          profile_row.neon_account_id is not null
          and cl.neon_account_id = profile_row.neon_account_id
        )
      )
    order by pe.occurred_at asc, pe.created_at asc
  loop
    select * into lead_row
    from public.constituent_leads
    where id = event_row.lead_id;

    resolved_season_member_id := event_row.season_member_id;

    if event_row.season_id is not null and resolved_season_member_id is null then
      select sm.id into resolved_season_member_id
      from public.gpe_season_members sm
      where sm.season_id = event_row.season_id
        and (
          sm.user_id = p_profile_id
          or (
            coalesce(profile_row.neon_account_id, lead_row.neon_account_id) is not null
            and sm.neon_account_id = coalesce(profile_row.neon_account_id, lead_row.neon_account_id)
          )
          or lower(coalesce(sm.contact_email, '')) = lower(coalesce(profile_row.email, event_row.email_normalized, lead_row.email_normalized, ''))
        )
      order by case when sm.user_id = p_profile_id then 1 else 2 end
      limit 1;
    end if;

    if resolved_season_member_id is not null then
      update public.gpe_season_members
      set user_id = coalesce(user_id, p_profile_id),
          neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id, lead_row.neon_account_id),
          contact_email = coalesce(contact_email, profile_row.email, event_row.email_normalized, lead_row.email_normalized),
          updated_at = now()
      where id = resolved_season_member_id;
    end if;

    result := public.service_record_point_event(
      event_row.event_type,
      coalesce(event_row.email_normalized, profile_row.email),
      p_profile_id,
      event_row.lead_action_id,
      event_row.lead_id,
      event_row.source,
      event_row.source_id,
      event_row.season_id,
      resolved_season_member_id,
      event_row.challenge_id,
      event_row.camp_submission_action_id,
      null,
      event_row.campaign_slug,
      event_row.petition_slug,
      coalesce(event_row.metadata, '{}'::jsonb) || jsonb_build_object(
        'claimed_from_pending_profile_link', true,
        'claimed_for_profile_id', p_profile_id
      ),
      event_row.occurred_at
    );

    result_status := coalesce(result->>'status', 'not_applicable');
    result_points_status := case result_status
      when 'awarded' then 'awarded'::public.gpe_action_points_status
      when 'pending_identity' then 'pending_identity'::public.gpe_action_points_status
      when 'duplicate' then 'duplicate'::public.gpe_action_points_status
      when 'ineligible' then 'ineligible'::public.gpe_action_points_status
      when 'failed' then 'failed'::public.gpe_action_points_status
      else 'not_applicable'::public.gpe_action_points_status
    end;

    if result_status = 'awarded' then
      claimed_count := claimed_count + 1;
      awarded_total := awarded_total + coalesce((result->>'awardedPoints')::integer, 0);
    elsif result_status = 'duplicate' then
      duplicate_count := duplicate_count + 1;
    else
      pending_total := pending_total + coalesce((result->>'pendingPoints')::integer, 0);
    end if;

    if event_row.lead_action_id is not null then
      update public.lead_actions
      set user_id = coalesce(user_id, p_profile_id),
          season_member_id = coalesce(season_member_id, resolved_season_member_id),
          hub_identity_status = 'succeeded',
          points_status = result_points_status,
          points_result = coalesce(points_result, '{}'::jsonb) || jsonb_build_object(
            'status', result_points_status,
            'awardedPoints', coalesce((result->>'awardedPoints')::integer, 0),
            'pendingPoints', coalesce((result->>'pendingPoints')::integer, 0),
            'claimResult', result,
            'claimedFromPendingProfileLink', true
          ),
          pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object(
            'hub', 'success',
            'points', case
              when result_status = 'awarded' then 'success'
              when result_status = 'pending_identity' then 'pending'
              else result_status
            end
          )
      where id = event_row.lead_action_id;
    end if;
  end loop;

  return jsonb_build_object(
    'claimedAwards', claimed_count,
    'awardedPoints', awarded_total,
    'pendingPoints', pending_total,
    'duplicates', duplicate_count
  );
end;
$$;

revoke all on function public.service_claim_pending_point_awards_for_profile(uuid) from public;
grant execute on function public.service_claim_pending_point_awards_for_profile(uuid) to service_role;

create or replace function public.attach_petition_history_after_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null then
    perform public.service_attach_petition_history_to_profile(new.id);
    perform public.service_claim_pending_point_awards_for_profile(new.id);
  end if;
  return new;
end;
$$;
