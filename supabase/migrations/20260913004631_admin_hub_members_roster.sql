create table if not exists public.admin_action_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  participant_key text,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text,
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_action_audit_state_objects check (
    jsonb_typeof(previous_state) = 'object'
    and jsonb_typeof(new_state) = 'object'
    and jsonb_typeof(metadata) = 'object'
  )
);

alter table public.membership_access
  add column if not exists neon_membership_id text;

create index if not exists membership_access_neon_membership_id_idx
  on public.membership_access (neon_membership_id)
  where neon_membership_id is not null;

create index if not exists admin_action_audit_participant_idx
  on public.admin_action_audit_log (participant_key, created_at desc)
  where participant_key is not null;

create index if not exists admin_action_audit_admin_idx
  on public.admin_action_audit_log (admin_id, created_at desc);

alter table public.admin_action_audit_log enable row level security;

grant select, insert on public.admin_action_audit_log to authenticated;

drop policy if exists "admin_action_audit_admin_read" on public.admin_action_audit_log;
create policy "admin_action_audit_admin_read"
on public.admin_action_audit_log
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "admin_action_audit_admin_insert" on public.admin_action_audit_log;
create policy "admin_action_audit_admin_insert"
on public.admin_action_audit_log
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create table if not exists public.hub_participant_directory (
  participant_key text primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  auth_user_id uuid,
  season_member_id uuid references public.gpe_season_members(id) on delete set null,
  normalized_email text,
  display_name text,
  first_name text,
  last_name text,
  neon_account_id text,
  neon_membership_id text,
  hub_profile_status text not null default 'missing_hub',
  hub_account_status text not null default 'unknown',
  neon_account_status text not null default 'unknown',
  neon_membership_status text,
  camp_status text,
  invitation_status text,
  onboarding_status text,
  reconciliation_status text not null default 'unmatched',
  identity_confidence text not null default 'low',
  source_kinds text[] not null default '{}'::text[],
  current_hub_points integer not null default 0,
  current_season_points integer not null default 0,
  current_camp_points integer not null default 0,
  pending_points integer not null default 0,
  past_actions_count integer not null default 0,
  last_activity_at timestamptz,
  signup_started_at timestamptz,
  joined_at timestamptz,
  last_refreshed_at timestamptz not null default now(),
  raw_refs jsonb not null default '{}'::jsonb,
  constraint hub_participant_directory_raw_refs_object check (jsonb_typeof(raw_refs) = 'object')
);

create index if not exists hub_participant_directory_email_idx
  on public.hub_participant_directory (normalized_email)
  where normalized_email is not null;

create index if not exists hub_participant_directory_profile_idx
  on public.hub_participant_directory (profile_id)
  where profile_id is not null;

create index if not exists hub_participant_directory_neon_idx
  on public.hub_participant_directory (neon_account_id)
  where neon_account_id is not null;

create index if not exists hub_participant_directory_status_idx
  on public.hub_participant_directory (
    hub_profile_status,
    hub_account_status,
    neon_account_status,
    neon_membership_status,
    camp_status,
    reconciliation_status
  );

alter table public.hub_participant_directory enable row level security;

grant select on public.hub_participant_directory to authenticated;
grant select, insert, update, delete on public.hub_participant_directory to service_role;

drop policy if exists "hub_participant_directory_admin_read" on public.hub_participant_directory;
create policy "hub_participant_directory_admin_read"
on public.hub_participant_directory
for select
to authenticated
using (public.is_admin(auth.uid()));

create or replace function public.admin_refresh_hub_participant_directory()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  refreshed_count integer := 0;
begin
  if actor is not null and not public.is_admin(actor) then
    raise exception 'Admin access required.';
  end if;

  delete from public.hub_participant_directory;

  insert into public.hub_participant_directory (
    participant_key,
    profile_id,
    auth_user_id,
    season_member_id,
    normalized_email,
    display_name,
    first_name,
    last_name,
    neon_account_id,
    neon_membership_id,
    hub_profile_status,
    hub_account_status,
    neon_account_status,
    neon_membership_status,
    camp_status,
    invitation_status,
    onboarding_status,
    reconciliation_status,
    identity_confidence,
    source_kinds,
    current_hub_points,
    current_season_points,
    current_camp_points,
    pending_points,
    past_actions_count,
    last_activity_at,
    signup_started_at,
    joined_at,
    raw_refs
  )
  with profiles_source as (
    select
      coalesce('profile:' || p.id::text, 'email:' || lower(p.email), 'neon:' || p.neon_account_id) as participant_key,
      p.id as profile_id,
      p.id as auth_user_id,
      null::uuid as season_member_id,
      lower(p.email) as normalized_email,
      nullif(p.full_name, '') as display_name,
      nullif(p.first_name, '') as first_name,
      nullif(p.last_name, '') as last_name,
      nullif(p.neon_account_id, '') as neon_account_id,
      null::text as neon_membership_id,
      case
        when p.id is not null and nullif(p.email, '') is not null then 'hub_active'
        when p.id is not null then 'hub_incomplete'
        else 'missing_hub'
      end as hub_profile_status,
      coalesce(nullif(p.account_status, ''), 'active') as hub_account_status,
      case when nullif(p.neon_account_id, '') is not null then 'linked' else 'missing_neon' end as neon_account_status,
      coalesce(nullif(p.membership_access_state, ''), nullif(p.member_status, ''), nullif(p.membership_status, '')) as neon_membership_status,
      null::text as camp_status,
      null::text as invitation_status,
      case
        when nullif(p.email, '') is null then 'profile_missing_email'
        when coalesce(p.membership_access_state, p.member_status, p.membership_status) = 'membership_pending' then 'membership_confirmed_hub_signup_incomplete'
        else 'complete'
      end as onboarding_status,
      1 as source_rank,
      'hub_profile'::text as source_kind,
      p.created_at as signup_started_at,
      p.created_at as joined_at,
      p.updated_at as last_seen_at,
      jsonb_build_object('profileId', p.id) as raw_ref
    from public.profiles p
  ),
  auth_source as (
    select
      coalesce('profile:' || u.id::text, 'email:' || lower(u.email)) as participant_key,
      p.id as profile_id,
      u.id as auth_user_id,
      null::uuid as season_member_id,
      lower(u.email) as normalized_email,
      coalesce(nullif(p.full_name, ''), nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), lower(u.email)) as display_name,
      nullif(p.first_name, '') as first_name,
      nullif(p.last_name, '') as last_name,
      nullif(p.neon_account_id, '') as neon_account_id,
      null::text as neon_membership_id,
      case when p.id is null then 'hub_incomplete' else 'hub_active' end as hub_profile_status,
      case when u.email_confirmed_at is null then 'auth_unconfirmed' else 'auth_confirmed' end as hub_account_status,
      case when nullif(p.neon_account_id, '') is not null then 'linked' else 'missing_neon' end as neon_account_status,
      coalesce(nullif(p.membership_access_state, ''), nullif(p.member_status, ''), nullif(p.membership_status, '')) as neon_membership_status,
      null::text as camp_status,
      null::text as invitation_status,
      case when p.id is null then 'auth_user_profile_missing' else 'complete' end as onboarding_status,
      2 as source_rank,
      'auth_user'::text as source_kind,
      u.created_at as signup_started_at,
      p.created_at as joined_at,
      greatest(coalesce(u.last_sign_in_at, u.created_at), coalesce(p.updated_at, u.created_at)) as last_seen_at,
      jsonb_build_object('authUserId', u.id) as raw_ref
    from auth.users u
    left join public.profiles p on p.id = u.id
  ),
  season_source as (
    select
      coalesce('profile:' || sm.user_id::text, 'email:' || sm.contact_email, 'neon:' || sm.neon_account_id, 'season:' || sm.id::text) as participant_key,
      sm.user_id as profile_id,
      sm.user_id as auth_user_id,
      sm.id as season_member_id,
      sm.contact_email as normalized_email,
      null::text as display_name,
      null::text as first_name,
      null::text as last_name,
      nullif(sm.neon_account_id, '') as neon_account_id,
      null::text as neon_membership_id,
      case when sm.user_id is null then 'missing_hub' else 'hub_active' end as hub_profile_status,
      case when sm.user_id is null then 'no_auth_user' else 'auth_linked' end as hub_account_status,
      case when nullif(sm.neon_account_id, '') is not null then 'linked' else 'unknown' end as neon_account_status,
      null::text as neon_membership_status,
      sm.status::text as camp_status,
      null::text as invitation_status,
      case when sm.user_id is null then 'camp_pending_identity' else 'complete' end as onboarding_status,
      3 as source_rank,
      'camp_participant'::text as source_kind,
      sm.created_at as signup_started_at,
      sm.joined_at as joined_at,
      sm.updated_at as last_seen_at,
      jsonb_build_object('seasonMemberId', sm.id, 'seasonId', sm.season_id) as raw_ref
    from public.gpe_season_members sm
  ),
  neon_source as (
    select
      coalesce('profile:' || ma.user_id::text, 'email:' || ma.normalized_email, 'neon:' || ma.neon_account_id, 'membership_access:' || ma.id::text) as participant_key,
      ma.user_id as profile_id,
      ma.user_id as auth_user_id,
      null::uuid as season_member_id,
      ma.normalized_email,
      null::text as display_name,
      null::text as first_name,
      null::text as last_name,
      nullif(ma.neon_account_id, '') as neon_account_id,
      nullif(ma.neon_membership_id, '') as neon_membership_id,
      case when ma.user_id is null then 'missing_hub' else 'hub_active' end as hub_profile_status,
      case when ma.user_id is null then 'no_auth_user' else 'auth_linked' end as hub_account_status,
      case when nullif(ma.neon_account_id, '') is not null then 'linked' else 'membership_record_without_neon_id' end as neon_account_status,
      coalesce(nullif(ma.access_state, ''), nullif(ma.membership_status, ''), case when ma.is_active then 'active' end, 'unknown') as neon_membership_status,
      null::text as camp_status,
      null::text as invitation_status,
      case when ma.user_id is null then 'membership_confirmed_hub_signup_incomplete' else 'complete' end as onboarding_status,
      4 as source_rank,
      'neon_membership'::text as source_kind,
      ma.created_at as signup_started_at,
      ma.created_at as joined_at,
      ma.updated_at as last_seen_at,
      jsonb_build_object('membershipAccessId', ma.id) as raw_ref
    from public.membership_access ma
    where ma.user_id is not null or ma.normalized_email is not null or ma.neon_account_id is not null
  ),
  lead_source as (
    select
      coalesce('profile:' || cl.hub_profile_id::text, 'email:' || cl.email_normalized, 'neon:' || cl.neon_account_id, 'lead:' || cl.id::text) as participant_key,
      cl.hub_profile_id as profile_id,
      cl.hub_profile_id as auth_user_id,
      null::uuid as season_member_id,
      cl.email_normalized as normalized_email,
      nullif(trim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')), '') as display_name,
      nullif(cl.first_name, '') as first_name,
      nullif(cl.last_name, '') as last_name,
      nullif(cl.neon_account_id, '') as neon_account_id,
      null::text as neon_membership_id,
      case when cl.hub_profile_id is null then 'missing_hub' else 'hub_active' end as hub_profile_status,
      case when cl.hub_profile_id is null then 'lead_only' else 'auth_linked' end as hub_account_status,
      case when nullif(cl.neon_account_id, '') is not null then 'linked' else 'unknown' end as neon_account_status,
      nullif(cl.membership_state, '') as neon_membership_status,
      null::text as camp_status,
      null::text as invitation_status,
      case when cl.hub_profile_id is null then 'form_identity_no_hub_profile' else 'complete' end as onboarding_status,
      5 as source_rank,
      'form_lead'::text as source_kind,
      cl.created_at as signup_started_at,
      cl.created_at as joined_at,
      cl.updated_at as last_seen_at,
      jsonb_build_object('leadId', cl.id) as raw_ref
    from public.constituent_leads cl
  ),
  invite_source as (
    select
      coalesce('profile:' || hi.user_id::text, 'email:' || hi.normalized_email, 'neon:' || hi.neon_account_id, 'invite:' || hi.id::text) as participant_key,
      hi.user_id as profile_id,
      hi.user_id as auth_user_id,
      null::uuid as season_member_id,
      hi.normalized_email,
      null::text as display_name,
      null::text as first_name,
      null::text as last_name,
      nullif(hi.neon_account_id, '') as neon_account_id,
      null::text as neon_membership_id,
      case when hi.user_id is null then 'missing_hub' else 'hub_active' end as hub_profile_status,
      case when hi.accepted_at is not null then 'invite_accepted' when hi.sent_at is not null then 'invite_sent' else 'invite_pending' end as hub_account_status,
      case when nullif(hi.neon_account_id, '') is not null then 'linked' else 'unknown' end as neon_account_status,
      null::text as neon_membership_status,
      null::text as camp_status,
      hi.status as invitation_status,
      case when hi.accepted_at is null then 'hub_invite_not_accepted' else 'complete' end as onboarding_status,
      6 as source_rank,
      'hub_invitation'::text as source_kind,
      hi.created_at as signup_started_at,
      hi.accepted_at as joined_at,
      coalesce(hi.accepted_at, hi.sent_at, hi.updated_at) as last_seen_at,
      jsonb_build_object('invitationId', hi.id, 'source', hi.source, 'sourceId', hi.source_id) as raw_ref
    from public.hub_invitations hi
  ),
  all_sources as (
    select * from profiles_source
    union all select * from auth_source
    union all select * from season_source
    union all select * from neon_source
    union all select * from lead_source
    union all select * from invite_source
  ),
  merged as (
    select
      participant_key,
      (array_agg(profile_id order by source_rank) filter (where profile_id is not null))[1] as profile_id,
      (array_agg(auth_user_id order by source_rank) filter (where auth_user_id is not null))[1] as auth_user_id,
      (array_agg(season_member_id order by source_rank) filter (where season_member_id is not null))[1] as season_member_id,
      (array_agg(normalized_email order by source_rank) filter (where normalized_email is not null))[1] as normalized_email,
      (array_agg(display_name order by source_rank) filter (where display_name is not null))[1] as display_name,
      (array_agg(first_name order by source_rank) filter (where first_name is not null))[1] as first_name,
      (array_agg(last_name order by source_rank) filter (where last_name is not null))[1] as last_name,
      (array_agg(neon_account_id order by source_rank) filter (where neon_account_id is not null))[1] as neon_account_id,
      (array_agg(neon_membership_id order by source_rank) filter (where neon_membership_id is not null))[1] as neon_membership_id,
      (array_agg(hub_profile_status order by source_rank))[1] as hub_profile_status,
      (array_agg(hub_account_status order by source_rank))[1] as hub_account_status,
      (array_agg(neon_account_status order by source_rank))[1] as neon_account_status,
      (array_agg(neon_membership_status order by source_rank) filter (where neon_membership_status is not null))[1] as neon_membership_status,
      (array_agg(camp_status order by source_rank) filter (where camp_status is not null))[1] as camp_status,
      (array_agg(invitation_status order by source_rank) filter (where invitation_status is not null))[1] as invitation_status,
      (array_agg(onboarding_status order by source_rank))[1] as onboarding_status,
      array_agg(distinct source_kind order by source_kind) as source_kinds,
      min(signup_started_at) as signup_started_at,
      min(joined_at) as joined_at,
      max(last_seen_at) as last_seen_at,
      jsonb_agg(raw_ref) as raw_refs
    from all_sources
    where participant_key is not null
    group by participant_key
  ),
  enriched as (
    select
      m.*,
      coalesce(points.current_hub_points, 0)::integer as current_hub_points,
      coalesce(points.current_season_points, 0)::integer as current_season_points,
      coalesce(points.current_camp_points, 0)::integer as current_camp_points,
      coalesce(pending.pending_points, 0)::integer as pending_points,
      coalesce(actions.past_actions_count, 0)::integer as past_actions_count,
      greatest(coalesce(m.last_seen_at, '-infinity'::timestamptz), coalesce(actions.last_activity_at, '-infinity'::timestamptz)) as last_activity_at,
      email_conflicts.profile_count as conflicting_profiles,
      email_conflicts.neon_count as conflicting_neon_accounts
    from merged m
    left join lateral (
      select
        coalesce(sum(pt.points_earned) filter (where pt.counts_for_ongoing and pt.approval_status = 'approved'), 0) as current_hub_points,
        coalesce(sum(pt.points_earned) filter (where pt.counts_for_season and pt.approval_status = 'approved'), 0) as current_season_points,
        coalesce(sum(pt.points_earned) filter (where pt.counts_for_cabin and pt.approval_status = 'approved'), 0) as current_camp_points
      from public.point_transactions pt
      where m.profile_id is not null and pt.user_id = m.profile_id
    ) points on true
    left join lateral (
      select coalesce(sum(gppa.points) filter (where gppa.status = 'pending'), 0) as pending_points
      from public.gpe_pending_point_awards gppa
      where (m.profile_id is not null and gppa.user_id = m.profile_id)
         or (m.normalized_email is not null and gppa.email_normalized = m.normalized_email)
    ) pending on true
    left join lateral (
      select count(*) as past_actions_count, max(la.occurred_at) as last_activity_at
      from public.lead_actions la
      left join public.constituent_leads cl on cl.id = la.lead_id
      where (m.profile_id is not null and (la.user_id = m.profile_id or cl.hub_profile_id = m.profile_id))
         or (m.normalized_email is not null and cl.email_normalized = m.normalized_email)
         or (m.neon_account_id is not null and cl.neon_account_id = m.neon_account_id)
    ) actions on true
    left join lateral (
      select
        count(distinct s.profile_id) filter (where s.profile_id is not null) as profile_count,
        count(distinct s.neon_account_id) filter (where s.neon_account_id is not null) as neon_count
      from all_sources s
      where m.normalized_email is not null and s.normalized_email = m.normalized_email
    ) email_conflicts on true
  )
  select
    e.participant_key,
    e.profile_id,
    e.auth_user_id,
    e.season_member_id,
    e.normalized_email,
    coalesce(e.display_name, nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), ''), e.normalized_email, e.neon_account_id, 'Unknown participant') as display_name,
    e.first_name,
    e.last_name,
    e.neon_account_id,
    e.neon_membership_id,
    e.hub_profile_status,
    e.hub_account_status,
    e.neon_account_status,
    e.neon_membership_status,
    e.camp_status,
    e.invitation_status,
    e.onboarding_status,
    case
      when coalesce(e.conflicting_profiles, 0) > 1 or coalesce(e.conflicting_neon_accounts, 0) > 1 then 'needs_reconciliation'
      when e.profile_id is not null and e.neon_account_id is not null then 'matched'
      when e.profile_id is null and (e.neon_account_id is not null or e.neon_membership_status in ('active', 'current')) then 'missing_hub'
      when e.profile_id is not null and e.neon_account_id is null then 'missing_neon'
      else 'unmatched'
    end as reconciliation_status,
    case
      when coalesce(e.conflicting_profiles, 0) > 1 or coalesce(e.conflicting_neon_accounts, 0) > 1 then 'conflict'
      when e.profile_id is not null or e.neon_account_id is not null then 'high'
      when e.normalized_email is not null then 'email'
      else 'low'
    end as identity_confidence,
    e.source_kinds,
    e.current_hub_points,
    e.current_season_points,
    e.current_camp_points,
    e.pending_points,
    e.past_actions_count,
    nullif(e.last_activity_at, '-infinity'::timestamptz) as last_activity_at,
    e.signup_started_at,
    e.joined_at,
    jsonb_build_object('sources', e.raw_refs)
  from enriched e;

  get diagnostics refreshed_count = row_count;

  return jsonb_build_object('ok', true, 'refreshedCount', refreshed_count, 'refreshedAt', now());
end;
$$;

create or replace function public.admin_get_hub_member_roster(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_hub_status text default 'all',
  p_neon_status text default 'all',
  p_reconciliation_status text default 'all',
  p_camp_status text default 'all',
  p_points_filter text default 'all',
  p_activity_filter text default 'all',
  p_sort text default 'last_activity_desc'
)
returns table (
  total_count bigint,
  participant_key text,
  profile_id uuid,
  auth_user_id uuid,
  season_member_id uuid,
  display_name text,
  email text,
  hub_profile_status text,
  hub_account_status text,
  neon_account_status text,
  neon_membership_status text,
  neon_account_id text,
  neon_membership_id text,
  camp_status text,
  invitation_status text,
  onboarding_status text,
  reconciliation_status text,
  identity_confidence text,
  source_kinds text[],
  current_hub_points integer,
  current_season_points integer,
  current_camp_points integer,
  pending_points integer,
  past_actions_count integer,
  last_activity_at timestamptz,
  signup_started_at timestamptz,
  joined_at timestamptz,
  last_refreshed_at timestamptz
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
  with filtered as (
    select d.*
    from public.hub_participant_directory d
    where (
        normalized_query = ''
        or lower(coalesce(d.display_name, '')) like '%' || normalized_query || '%'
        or lower(coalesce(d.normalized_email, '')) like '%' || normalized_query || '%'
        or lower(coalesce(d.neon_account_id, '')) like '%' || normalized_query || '%'
        or lower(coalesce(d.neon_membership_id, '')) like '%' || normalized_query || '%'
        or d.profile_id::text = normalized_query
        or d.auth_user_id::text = normalized_query
      )
      and (p_hub_status = 'all' or d.hub_profile_status = p_hub_status or d.hub_account_status = p_hub_status)
      and (p_neon_status = 'all' or d.neon_account_status = p_neon_status or d.neon_membership_status = p_neon_status)
      and (p_reconciliation_status = 'all' or d.reconciliation_status = p_reconciliation_status)
      and (p_camp_status = 'all' or coalesce(d.camp_status, 'none') = p_camp_status)
      and (
        p_points_filter = 'all'
        or (p_points_filter = 'has_points' and (d.current_hub_points <> 0 or d.current_season_points <> 0 or d.current_camp_points <> 0))
        or (p_points_filter = 'no_points' and d.current_hub_points = 0 and d.current_season_points = 0 and d.current_camp_points = 0)
        or (p_points_filter = 'pending_points' and d.pending_points > 0)
      )
      and (
        p_activity_filter = 'all'
        or (p_activity_filter = 'recent' and d.last_activity_at >= now() - interval '30 days')
        or (p_activity_filter = 'inactive' and (d.last_activity_at is null or d.last_activity_at < now() - interval '90 days'))
        or (p_activity_filter = 'incomplete_signup' and d.onboarding_status <> 'complete')
        or (p_activity_filter = 'pending_invite' and coalesce(d.invitation_status, '') in ('pending', 'sent'))
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
    c.season_member_id,
    c.display_name,
    c.normalized_email as email,
    c.hub_profile_status,
    c.hub_account_status,
    c.neon_account_status,
    c.neon_membership_status,
    c.neon_account_id,
    c.neon_membership_id,
    c.camp_status,
    c.invitation_status,
    c.onboarding_status,
    c.reconciliation_status,
    c.identity_confidence,
    c.source_kinds,
    c.current_hub_points,
    c.current_season_points,
    c.current_camp_points,
    c.pending_points,
    c.past_actions_count,
    c.last_activity_at,
    c.signup_started_at,
    c.joined_at,
    c.last_refreshed_at
  from counted c
  order by
    case when p_sort = 'name_asc' then lower(coalesce(c.display_name, c.normalized_email, '')) end asc,
    case when p_sort = 'joined_desc' then c.joined_at end desc nulls last,
    case when p_sort = 'points_desc' then c.current_hub_points end desc,
    case when p_sort = 'reconciliation' then c.reconciliation_status end asc,
    c.last_activity_at desc nulls last,
    c.signup_started_at desc nulls last
  limit effective_limit
  offset effective_offset;
end;
$$;

create or replace function public.admin_get_hub_participant_detail(p_participant_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  participant public.hub_participant_directory%rowtype;
  point_history jsonb := '[]'::jsonb;
  actions jsonb := '[]'::jsonb;
  audits jsonb := '[]'::jsonb;
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

  if participant.profile_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'transactionId', pt.id,
      'date', pt.occurred_at,
      'points', pt.points_earned,
      'reason', coalesce(pt.metadata->>'reason', pt.action_type, pt.source),
      'ruleKey', coalesce(pt.metadata->>'rule_action_type', pt.action_type),
      'sourceType', pt.source,
      'sourceRecordId', pt.source_id,
      'adminNote', pt.metadata->>'admin_note',
      'awardedBy', nullif(pt.metadata->>'awarded_by', ''),
      'approvalStatus', pt.approval_status,
      'countsForOngoing', pt.counts_for_ongoing,
      'countsForSeason', pt.counts_for_season,
      'countsForCabin', pt.counts_for_cabin
    ) order by pt.occurred_at desc, pt.created_at desc), '[]'::jsonb)
    into point_history
    from public.point_transactions pt
    where pt.user_id = participant.profile_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', la.id,
    'actionType', la.action_type,
    'actionSlug', la.action_slug,
    'provider', la.provider,
    'providerActionId', la.provider_action_id,
    'providerSignatureId', la.provider_signature_id,
    'formSubmissionId', la.form_submission_id,
    'campaignSlug', la.campaign_slug,
    'sourceUrl', la.source_url,
    'membershipChoice', la.membership_choice,
    'neonSyncStatus', la.neon_sync_status,
    'hubIdentityStatus', la.hub_identity_status,
    'pointsStatus', la.points_status,
    'generalPointTransactionId', la.general_point_transaction_id,
    'campPointTransactionId', la.camp_point_transaction_id,
    'campLedgerId', la.camp_ledger_id,
    'campSubmissionId', la.camp_submission_id,
    'campSubmissionActionId', la.camp_submission_action_id,
    'seasonId', la.season_id,
    'seasonMemberId', la.season_member_id,
    'challengeId', la.challenge_id,
    'occurredAt', la.occurred_at
  ) order by la.occurred_at desc, la.created_at desc), '[]'::jsonb)
  into actions
  from public.lead_actions la
  left join public.constituent_leads cl on cl.id = la.lead_id
  where (participant.profile_id is not null and (la.user_id = participant.profile_id or cl.hub_profile_id = participant.profile_id))
     or (participant.normalized_email is not null and cl.email_normalized = participant.normalized_email)
     or (participant.neon_account_id is not null and cl.neon_account_id = participant.neon_account_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', aal.id,
    'adminId', aal.admin_id,
    'action', aal.action,
    'reason', aal.reason,
    'previousState', aal.previous_state,
    'newState', aal.new_state,
    'metadata', aal.metadata,
    'createdAt', aal.created_at
  ) order by aal.created_at desc), '[]'::jsonb)
  into audits
  from public.admin_action_audit_log aal
  where aal.participant_key = participant.participant_key
     or (participant.profile_id is not null and aal.profile_id = participant.profile_id);

  return jsonb_build_object(
    'participant', to_jsonb(participant),
    'pointHistory', point_history,
    'pastActions', actions,
    'auditLog', audits
  );
end;
$$;

create or replace function public.admin_log_participant_action(
  p_participant_key text,
  p_profile_id uuid,
  p_action text,
  p_reason text default null,
  p_previous_state jsonb default '{}'::jsonb,
  p_new_state jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  audit_id uuid;
begin
  if actor is null or not public.is_admin(actor) then
    raise exception 'Admin access required.';
  end if;
  if nullif(trim(coalesce(p_action, '')), '') is null then
    raise exception 'Audit action is required.';
  end if;

  insert into public.admin_action_audit_log (
    admin_id,
    participant_key,
    profile_id,
    action,
    reason,
    previous_state,
    new_state,
    metadata
  )
  values (
    actor,
    nullif(trim(coalesce(p_participant_key, '')), ''),
    p_profile_id,
    p_action,
    nullif(trim(coalesce(p_reason, '')), ''),
    coalesce(p_previous_state, '{}'::jsonb),
    coalesce(p_new_state, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.admin_refresh_hub_participant_directory() from public, anon;
grant execute on function public.admin_refresh_hub_participant_directory() to authenticated, service_role;

revoke all on function public.admin_get_hub_member_roster(text, integer, integer, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_get_hub_member_roster(text, integer, integer, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.admin_get_hub_participant_detail(text) from public, anon;
grant execute on function public.admin_get_hub_participant_detail(text) to authenticated;

revoke all on function public.admin_log_participant_action(text, uuid, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.admin_log_participant_action(text, uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
