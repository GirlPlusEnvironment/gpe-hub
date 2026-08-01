create or replace function public.service_finalize_petition_points(
  p_user_id uuid,
  p_lead_action_id uuid,
  p_submission_action_id uuid default null,
  p_season_id uuid default null,
  p_season_member_id uuid default null,
  p_challenge_id uuid default null,
  p_cabin_id uuid default null,
  p_campaign_slug text default null,
  p_petition_slug text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.lead_actions%rowtype;
  lead_row public.constituent_leads%rowtype;
  challenge_row public.gpe_challenges%rowtype;
  season_member_row public.gpe_season_members%rowtype;
  general_result jsonb;
  camp_result jsonb := jsonb_build_object('status', 'not_applicable', 'points', 0, 'awardedPoints', 0, 'pendingPoints', 0);
  awarded_points integer := 0;
  pending_points integer := 0;
  total_potential integer := 0;
  final_status public.gpe_action_points_status := 'not_applicable'::public.gpe_action_points_status;
  resolved_season_member_id uuid;
  resolved_cabin_id uuid;
  resolved_camp_source_id uuid;
  camp_transaction_id uuid;
  resolved_camp_ledger_id uuid;
begin
  if p_lead_action_id is null then
    raise exception 'Petition point finalization requires lead_action_id.';
  end if;

  select * into action_row
  from public.lead_actions
  where id = p_lead_action_id
  for update;
  if not found then
    raise exception 'Lead action not found.';
  end if;

  select * into lead_row
  from public.constituent_leads
  where id = action_row.lead_id;

  resolved_season_member_id := coalesce(p_season_member_id, action_row.season_member_id);

  if resolved_season_member_id is null and coalesce(p_user_id, action_row.user_id) is not null and coalesce(p_season_id, action_row.season_id) is not null then
    select sm.id into resolved_season_member_id
    from public.gpe_season_members sm
    where sm.season_id = coalesce(p_season_id, action_row.season_id)
      and (
        sm.user_id = coalesce(p_user_id, action_row.user_id)
        or (lead_row.neon_account_id is not null and sm.neon_account_id = lead_row.neon_account_id)
        or lower(coalesce(sm.contact_email, '')) = lower(coalesce(lead_row.email_normalized, ''))
      )
    order by case when sm.user_id = coalesce(p_user_id, action_row.user_id) then 1 else 2 end
    limit 1;
  end if;

  if resolved_season_member_id is not null then
    select * into season_member_row
    from public.gpe_season_members
    where id = resolved_season_member_id;
    resolved_cabin_id := coalesce(p_cabin_id, season_member_row.cabin_id);
  else
    resolved_cabin_id := p_cabin_id;
  end if;

  general_result := public.service_record_point_event(
    'PETITION_SUBMITTED',
    lead_row.email_normalized,
    coalesce(p_user_id, action_row.user_id),
    p_lead_action_id,
    action_row.lead_id,
    'action_network_petition',
    p_lead_action_id,
    null,
    null,
    null,
    null,
    null,
    p_campaign_slug,
    p_petition_slug,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('finalizer', 'service_finalize_petition_points'),
    p_occurred_at
  );

  if coalesce(p_challenge_id, action_row.challenge_id) is not null
     and coalesce(p_season_id, action_row.season_id) is not null
     and resolved_season_member_id is not null then
    resolved_camp_source_id := coalesce(p_submission_action_id, action_row.camp_submission_action_id, p_lead_action_id);

    camp_result := public.service_record_point_event(
      'CAMP_PETITION_COMPLETED',
      lead_row.email_normalized,
      coalesce(p_user_id, action_row.user_id),
      p_lead_action_id,
      action_row.lead_id,
      'camp_petition_challenge',
      resolved_camp_source_id,
      coalesce(p_season_id, action_row.season_id),
      resolved_season_member_id,
      coalesce(p_challenge_id, action_row.challenge_id),
      coalesce(p_submission_action_id, action_row.camp_submission_action_id),
      resolved_cabin_id,
      p_campaign_slug,
      p_petition_slug,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('finalizer', 'service_finalize_petition_points', 'lead_action_id', p_lead_action_id),
      p_occurred_at
    );

    resolved_camp_ledger_id := nullif(camp_result->>'ledgerId', '')::uuid;
    camp_transaction_id := nullif(camp_result->>'transactionId', '')::uuid;

    if coalesce(camp_result->>'status', '') = 'awarded' and resolved_camp_ledger_id is null then
      select id into resolved_camp_ledger_id
      from public.gpe_camp_points_ledger
      where metadata->>'point_event_id' = camp_result->>'pointEventId'
         or metadata->>'lead_action_id' = p_lead_action_id::text
      limit 1;

      if resolved_camp_ledger_id is null then
        select * into challenge_row
        from public.gpe_challenges
        where id = coalesce(p_challenge_id, action_row.challenge_id);

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
          coalesce(p_season_id, action_row.season_id),
          resolved_season_member_id,
          coalesce(p_user_id, action_row.user_id),
          null,
          null,
          coalesce(p_challenge_id, action_row.challenge_id),
          coalesce((camp_result->>'awardedPoints')::integer, (camp_result->>'points')::integer, challenge_row.point_value, 0),
          coalesce(challenge_row.title, 'Camp petition challenge'),
          'award',
          'challenge_award',
          'action_network_petition',
          null,
          null,
          jsonb_build_object(
            'point_transaction_id', camp_transaction_id,
            'pending_award_id', nullif(camp_result->>'pendingAwardId', '')::uuid,
            'point_event_id', nullif(camp_result->>'pointEventId', '')::uuid,
            'lead_action_id', p_lead_action_id,
            'auto_approved_mapped_petition', true
          ),
          camp_transaction_id,
          true,
          true,
          resolved_cabin_id is not null,
          resolved_cabin_id,
          'approved',
          coalesce(p_occurred_at, now())
        )
        returning id into resolved_camp_ledger_id;
      end if;

      update public.gpe_pending_point_awards
      set camp_ledger_id = coalesce(gpe_pending_point_awards.camp_ledger_id, resolved_camp_ledger_id),
          updated_at = now()
      where id = nullif(camp_result->>'pendingAwardId', '')::uuid;

      update public.gpe_point_events
      set camp_ledger_id = coalesce(gpe_point_events.camp_ledger_id, resolved_camp_ledger_id),
          points_result = coalesce(points_result, '{}'::jsonb) || jsonb_build_object('ledgerId', resolved_camp_ledger_id)
      where id = nullif(camp_result->>'pointEventId', '')::uuid;

      camp_result := camp_result || jsonb_build_object('ledgerId', resolved_camp_ledger_id);
    end if;
  end if;

  awarded_points := coalesce((general_result->>'awardedPoints')::integer, 0)
                  + coalesce((camp_result->>'awardedPoints')::integer, 0);
  pending_points := coalesce((general_result->>'pendingPoints')::integer, 0)
                  + coalesce((camp_result->>'pendingPoints')::integer, 0);
  total_potential := coalesce((general_result->>'totalPotential')::integer, coalesce((general_result->>'points')::integer, 0))
                   + coalesce((camp_result->>'totalPotential')::integer, coalesce((camp_result->>'points')::integer, 0));

  final_status := case
    when pending_points > 0 then 'pending_identity'::public.gpe_action_points_status
    when awarded_points > 0 then 'awarded'::public.gpe_action_points_status
    else 'not_applicable'::public.gpe_action_points_status
  end;

  update public.lead_actions
  set
    user_id = coalesce(user_id, p_user_id),
    season_member_id = coalesce(season_member_id, resolved_season_member_id),
    general_point_transaction_id = coalesce(general_point_transaction_id, nullif(general_result->>'transactionId', '')::uuid),
    camp_point_transaction_id = coalesce(camp_point_transaction_id, nullif(camp_result->>'transactionId', '')::uuid),
    camp_ledger_id = coalesce(camp_ledger_id, nullif(camp_result->>'ledgerId', '')::uuid),
    general_pending_award_id = coalesce(general_pending_award_id, nullif(general_result->>'pendingAwardId', '')::uuid),
    camp_pending_award_id = coalesce(camp_pending_award_id, nullif(camp_result->>'pendingAwardId', '')::uuid),
    points_status = final_status,
    completed_at = coalesce(completed_at, now()),
    points_result = coalesce(points_result, '{}'::jsonb) || jsonb_build_object(
      'status', final_status,
      'awardedPoints', awarded_points,
      'pendingPoints', pending_points,
      'general', general_result,
      'camp', camp_result,
      'total', awarded_points,
      'totalPotential', total_potential
    ),
    pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object(
      'points', case when pending_points > 0 then 'pending' when awarded_points > 0 then 'success' else 'not_applicable' end,
      'camp', case
        when coalesce(p_challenge_id, action_row.challenge_id) is null then 'not_applicable'
        when coalesce(camp_result->>'status', '') = 'awarded' then 'success'
        when coalesce(camp_result->>'status', '') = 'pending_identity' then 'pending'
        else coalesce(camp_result->>'status', 'not_applicable')
      end,
      'hub', case when coalesce(p_user_id, action_row.user_id) is null then 'pending' else 'success' end
    )
  where id = p_lead_action_id;

  return jsonb_build_object(
    'status', final_status,
    'awardedPoints', awarded_points,
    'pendingPoints', pending_points,
    'general', general_result,
    'camp', camp_result,
    'total', awarded_points,
    'totalPotential', total_potential
  );
end;
$$;

create or replace function public.service_attach_petition_history_to_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  action_row public.lead_actions%rowtype;
  lead_row public.constituent_leads%rowtype;
  finalized jsonb;
  attached_count integer := 0;
  awarded_total integer := 0;
  resolved_attach_season_member_id uuid;
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

  for action_row in
    select la.*
    from public.lead_actions la
    join public.constituent_leads cl on cl.id = la.lead_id
    where la.provider = 'action_network'
      and la.action_type = 'petition_signature'
      and (
        lower(cl.email_normalized) = lower(coalesce(profile_row.email, ''))
        or (profile_row.neon_account_id is not null and cl.neon_account_id = profile_row.neon_account_id)
      )
      and (
        la.user_id is null
        or la.points_status = 'pending_identity'
        or la.general_point_transaction_id is null
        or (
          la.challenge_id is not null
          and la.season_id is not null
          and (la.camp_point_transaction_id is null or la.camp_ledger_id is null)
        )
      )
  loop
    select * into lead_row
    from public.constituent_leads
    where id = action_row.lead_id;

    resolved_attach_season_member_id := action_row.season_member_id;

    if action_row.season_id is not null and resolved_attach_season_member_id is null then
      select sm.id into resolved_attach_season_member_id
      from public.gpe_season_members sm
      where sm.season_id = action_row.season_id
        and (
          sm.user_id = p_profile_id
          or (profile_row.neon_account_id is not null and sm.neon_account_id = profile_row.neon_account_id)
          or lower(coalesce(sm.contact_email, '')) = lower(coalesce(profile_row.email, lead_row.email_normalized, ''))
        )
      order by case when sm.user_id = p_profile_id then 1 else 2 end
      limit 1;
    end if;

    if resolved_attach_season_member_id is not null then
      update public.gpe_season_members
      set user_id = coalesce(user_id, p_profile_id),
          neon_account_id = coalesce(neon_account_id, profile_row.neon_account_id, lead_row.neon_account_id),
          contact_email = coalesce(contact_email, profile_row.email, lead_row.email_normalized),
          updated_at = now()
      where id = resolved_attach_season_member_id;
    end if;

    update public.lead_actions
    set
      user_id = p_profile_id,
      season_member_id = coalesce(lead_actions.season_member_id, resolved_attach_season_member_id),
      hub_identity_status = 'succeeded',
      pipeline_status = coalesce(pipeline_status, '{}'::jsonb) || jsonb_build_object('hub', 'success')
    where id = action_row.id;

    finalized := public.service_finalize_petition_points(
      p_profile_id,
      action_row.id,
      action_row.camp_submission_action_id,
      action_row.season_id,
      resolved_attach_season_member_id,
      action_row.challenge_id,
      null,
      action_row.campaign_slug,
      action_row.action_slug,
      jsonb_build_object('linked_from_history', true, 'lead_action_id', action_row.id),
      action_row.occurred_at
    );

    attached_count := attached_count + 1;
    awarded_total := awarded_total + coalesce((finalized->>'awardedPoints')::integer, 0);
  end loop;

  return jsonb_build_object('attachedActions', attached_count, 'awardedPoints', awarded_total);
end;
$$;

revoke all on function public.service_finalize_petition_points(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, timestamptz) from public;
grant execute on function public.service_finalize_petition_points(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, timestamptz) to service_role;
revoke all on function public.service_attach_petition_history_to_profile(uuid) from public;
grant execute on function public.service_attach_petition_history_to_profile(uuid) to service_role;
