create or replace function public.admin_get_membership_load_table(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default 'all',
  p_petition_filter text default 'all',
  p_sort text default 'name_asc'
)
returns table (
  total_count bigint,
  participant_key text,
  profile_id uuid,
  auth_user_id uuid,
  display_name text,
  email text,
  hub_status text,
  membership_status text,
  neon_status text,
  hub_profile_status text,
  hub_account_status text,
  neon_account_status text,
  neon_membership_status text,
  petition_count integer,
  latest_petition_title text,
  latest_petition_status text,
  latest_petition_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  normalized_query text := lower(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g'));
  effective_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  effective_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if actor is null or not public.is_admin(actor) then
    raise exception 'Admin access required.';
  end if;

  return query
  with petition_stats as (
    select
      d.participant_key,
      count(la.id)::integer as petition_count,
      (array_agg(coalesce(la.action_slug, la.campaign_slug, 'Petition') order by la.occurred_at desc nulls last, la.created_at desc))[1] as latest_petition_title,
      (array_agg(coalesce(la.points_status::text, la.pipeline_status->>'petition', 'recorded') order by la.occurred_at desc nulls last, la.created_at desc))[1] as latest_petition_status,
      max(coalesce(la.occurred_at, la.created_at)) as latest_petition_at,
      lower(coalesce(string_agg(distinct coalesce(la.action_slug, la.campaign_slug, 'Petition'), ' '), '')) as petition_titles_text
    from public.hub_participant_directory d
    left join public.constituent_leads cl
      on (
        (d.normalized_email is not null and cl.email_normalized = d.normalized_email)
        or (d.profile_id is not null and cl.hub_profile_id = d.profile_id)
        or (d.neon_account_id is not null and cl.neon_account_id = d.neon_account_id)
      )
    left join public.lead_actions la
      on la.lead_id = cl.id
      and coalesce(la.action_type, '') = 'petition_signature'
    group by d.participant_key
  ),
  filtered as (
    select
      d.*,
      coalesce(ps.petition_count, 0) as petition_count,
      ps.latest_petition_title,
      ps.latest_petition_status,
      ps.latest_petition_at
    from public.hub_participant_directory d
    left join petition_stats ps on ps.participant_key = d.participant_key
    where (
        normalized_query = ''
        or lower(coalesce(d.display_name, '')) like '%' || normalized_query || '%'
        or lower(coalesce(d.normalized_email, '')) like '%' || normalized_query || '%'
        or lower(coalesce(d.neon_account_id, '')) like '%' || normalized_query || '%'
        or lower(coalesce(d.neon_membership_id, '')) like '%' || normalized_query || '%'
        or d.profile_id::text = normalized_query
        or d.auth_user_id::text = normalized_query
        or lower(coalesce(ps.latest_petition_title, '')) like '%' || normalized_query || '%'
        or coalesce(ps.petition_titles_text, '') like '%' || normalized_query || '%'
      )
      and (
        p_status = 'all'
        or d.hub_profile_status = p_status
        or d.hub_account_status = p_status
        or d.neon_account_status = p_status
        or d.neon_membership_status = p_status
        or d.reconciliation_status = p_status
      )
      and (
        p_petition_filter = 'all'
        or (p_petition_filter = 'has_petitions' and coalesce(ps.petition_count, 0) > 0)
        or (p_petition_filter = 'no_petitions' and coalesce(ps.petition_count, 0) = 0)
      )
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    c.total_count,
    c.participant_key,
    c.profile_id,
    c.auth_user_id,
    coalesce(c.display_name, c.normalized_email, c.neon_account_id, 'Unknown') as display_name,
    c.normalized_email as email,
    c.hub_profile_status as hub_status,
    coalesce(c.neon_membership_status, c.hub_account_status, 'unknown') as membership_status,
    c.neon_account_status as neon_status,
    c.hub_profile_status,
    c.hub_account_status,
    c.neon_account_status,
    c.neon_membership_status,
    c.petition_count,
    c.latest_petition_title,
    c.latest_petition_status,
    c.latest_petition_at,
    c.joined_at,
    c.signup_started_at as created_at
  from counted c
  order by
    case when p_sort = 'name_asc' then lower(coalesce(c.display_name, c.normalized_email, '')) end asc,
    case when p_sort = 'created_desc' then c.signup_started_at end desc nulls last,
    case when p_sort = 'petitions_desc' then c.petition_count end desc,
    case when p_sort = 'latest_petition_desc' then c.latest_petition_at end desc nulls last,
    lower(coalesce(c.display_name, c.normalized_email, '')) asc
  limit effective_limit
  offset effective_offset;
end;
$$;

create or replace function public.admin_get_member_petition_history(p_participant_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  participant public.hub_participant_directory%rowtype;
  history jsonb := '[]'::jsonb;
begin
  if actor is null or not public.is_admin(actor) then
    raise exception 'Admin access required.';
  end if;

  select * into participant
  from public.hub_participant_directory
  where participant_key = p_participant_key;

  if not found then
    raise exception 'Participant not found.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'leadActionId', la.id,
    'leadId', la.lead_id,
    'submissionId', la.form_submission_id,
    'petitionTitle', coalesce(la.action_slug, la.campaign_slug, 'Petition'),
    'actionSlug', la.action_slug,
    'campaignSlug', la.campaign_slug,
    'sourceUrl', la.source_url,
    'status', coalesce(la.points_status::text, la.pipeline_status->>'petition', 'recorded'),
    'neonSyncStatus', la.neon_sync_status,
    'hubIdentityStatus', la.hub_identity_status,
    'providerSignatureId', la.provider_signature_id,
    'transactionId', la.general_point_transaction_id,
    'campTransactionId', la.camp_point_transaction_id,
    'campLedgerId', la.camp_ledger_id,
    'occurredAt', coalesce(la.occurred_at, la.created_at)
  ) order by coalesce(la.occurred_at, la.created_at) desc), '[]'::jsonb)
  into history
  from public.lead_actions la
  join public.constituent_leads cl on cl.id = la.lead_id
  where coalesce(la.action_type, '') = 'petition_signature'
    and (
      (participant.normalized_email is not null and cl.email_normalized = participant.normalized_email)
      or (participant.profile_id is not null and cl.hub_profile_id = participant.profile_id)
      or (participant.neon_account_id is not null and cl.neon_account_id = participant.neon_account_id)
    );

  return jsonb_build_object(
    'participantKey', participant.participant_key,
    'profileId', participant.profile_id,
    'displayName', coalesce(participant.display_name, participant.normalized_email, participant.neon_account_id, 'Unknown'),
    'email', participant.normalized_email,
    'petitions', history
  );
end;
$$;

revoke all on function public.admin_get_membership_load_table(text, integer, integer, text, text, text) from public, anon;
grant execute on function public.admin_get_membership_load_table(text, integer, integer, text, text, text) to authenticated;

revoke all on function public.admin_get_member_petition_history(text) from public, anon;
grant execute on function public.admin_get_member_petition_history(text) to authenticated;
