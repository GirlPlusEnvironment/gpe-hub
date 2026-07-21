do $$
begin
  if not exists (select 1 from pg_type where typname = 'gpe_event_registration_status') then
    create type public.gpe_event_registration_status as enum (
      'intent_created',
      'neon_handoff_required',
      'registered',
      'pending_reconciliation',
      'cancelled',
      'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gpe_event_claim_status') then
    create type public.gpe_event_claim_status as enum (
      'claimable',
      'claimed',
      'awarded',
      'rejected',
      'manual_review'
    );
  end if;
end
$$;

create table if not exists public.gpe_event_cache (
  id uuid primary key default gen_random_uuid(),
  neon_event_id text not null unique,
  slug text not null unique,
  title text not null,
  summary text,
  description text,
  event_type text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  location_name text,
  location_address text,
  is_virtual boolean not null default false,
  virtual_url text,
  image_url text,
  capacity integer,
  registration_count integer,
  registration_status text,
  pricing_summary text,
  member_pricing_summary text,
  public_url text,
  neon_calendar_url text,
  neon_registration_url text,
  constituent_portal_url text,
  impact_points integer,
  points_requires_attendance boolean not null default true,
  points_auto_award boolean not null default false,
  is_public boolean not null default true,
  tags text[] not null default '{}'::text[],
  raw_neon_payload jsonb not null default '{}'::jsonb,
  sync_status text not null default 'pending',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_event_cache_raw_payload_object check (jsonb_typeof(raw_neon_payload) = 'object'),
  constraint gpe_event_cache_capacity_nonnegative check (capacity is null or capacity >= 0),
  constraint gpe_event_cache_registration_count_nonnegative check (registration_count is null or registration_count >= 0),
  constraint gpe_event_cache_impact_points_nonnegative check (impact_points is null or impact_points >= 0)
);

create table if not exists public.gpe_event_registration_intents (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  event_id uuid references public.gpe_event_cache(id) on delete set null,
  neon_event_id text not null,
  email_normalized text not null,
  first_name text,
  last_name text,
  phone text,
  neon_account_id text,
  hub_user_id uuid references public.profiles(id) on delete set null,
  membership_outcome text,
  registration_status public.gpe_event_registration_status not null default 'intent_created',
  neon_registration_id text,
  neon_transaction_id text,
  registration_url text,
  submission_payload jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_event_registration_intents_email_lower check (email_normalized = lower(email_normalized)),
  constraint gpe_event_registration_intents_payload_object check (jsonb_typeof(submission_payload) = 'object')
);

create table if not exists public.gpe_event_participation_claims (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.gpe_event_cache(id) on delete set null,
  registration_intent_id uuid references public.gpe_event_registration_intents(id) on delete set null,
  neon_event_id text not null,
  neon_registration_id text,
  email_normalized text not null,
  neon_account_id text,
  hub_user_id uuid references public.profiles(id) on delete set null,
  claim_status public.gpe_event_claim_status not null default 'claimable',
  impact_points integer,
  point_transaction_id uuid references public.point_transactions(id) on delete set null,
  source text not null default 'neon_event_registration',
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_event_participation_claims_email_lower check (email_normalized = lower(email_normalized)),
  constraint gpe_event_participation_claims_impact_points_nonnegative check (impact_points is null or impact_points >= 0),
  constraint gpe_event_participation_claims_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.gpe_event_sync_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.gpe_event_cache(id) on delete set null,
  registration_intent_id uuid references public.gpe_event_registration_intents(id) on delete set null,
  integration text not null,
  operation text not null,
  success boolean not null,
  status_code integer,
  response_summary text,
  error_summary text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create unique index if not exists gpe_event_registration_one_neon_registration_idx
on public.gpe_event_registration_intents (neon_registration_id)
where neon_registration_id is not null;

create index if not exists gpe_event_cache_public_date_idx
on public.gpe_event_cache (is_public, starts_at desc);

create index if not exists gpe_event_cache_neon_event_idx
on public.gpe_event_cache (neon_event_id);

create index if not exists gpe_event_registration_email_idx
on public.gpe_event_registration_intents (email_normalized, created_at desc);

create index if not exists gpe_event_registration_event_idx
on public.gpe_event_registration_intents (neon_event_id, registration_status);

create unique index if not exists gpe_event_claim_unique_registration_idx
on public.gpe_event_participation_claims (neon_event_id, neon_registration_id, email_normalized)
where neon_registration_id is not null;

create index if not exists gpe_event_claim_user_idx
on public.gpe_event_participation_claims (hub_user_id, created_at desc);

create index if not exists gpe_event_sync_logs_created_idx
on public.gpe_event_sync_logs (integration, operation, created_at desc);

drop trigger if exists update_gpe_event_cache_updated_at on public.gpe_event_cache;
create trigger update_gpe_event_cache_updated_at
before update on public.gpe_event_cache
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gpe_event_registration_intents_updated_at on public.gpe_event_registration_intents;
create trigger update_gpe_event_registration_intents_updated_at
before update on public.gpe_event_registration_intents
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gpe_event_participation_claims_updated_at on public.gpe_event_participation_claims;
create trigger update_gpe_event_participation_claims_updated_at
before update on public.gpe_event_participation_claims
for each row execute function public.update_updated_at_column();

create or replace view public.gpe_public_events as
select
  id,
  neon_event_id,
  slug,
  title,
  summary,
  description,
  event_type,
  starts_at,
  ends_at,
  timezone,
  location_name,
  location_address,
  is_virtual,
  virtual_url,
  image_url,
  capacity,
  registration_count,
  registration_status,
  pricing_summary,
  member_pricing_summary,
  public_url,
  neon_calendar_url,
  neon_registration_url,
  constituent_portal_url,
  impact_points,
  points_requires_attendance,
  points_auto_award,
  tags,
  last_synced_at
from public.gpe_event_cache
where is_public;

alter table public.gpe_event_cache enable row level security;
alter table public.gpe_event_registration_intents enable row level security;
alter table public.gpe_event_participation_claims enable row level security;
alter table public.gpe_event_sync_logs enable row level security;

drop policy if exists "gpe_event_cache_public_read" on public.gpe_event_cache;
create policy "gpe_event_cache_public_read"
on public.gpe_event_cache
for select
using (is_public);

drop policy if exists "gpe_event_cache_team_manage" on public.gpe_event_cache;
create policy "gpe_event_cache_team_manage"
on public.gpe_event_cache
for all
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

drop policy if exists "gpe_event_registration_read_own_or_team" on public.gpe_event_registration_intents;
create policy "gpe_event_registration_read_own_or_team"
on public.gpe_event_registration_intents
for select
using (
  hub_user_id = auth.uid()
  or public.can_manage_camp(auth.uid())
);

drop policy if exists "gpe_event_registration_team_manage" on public.gpe_event_registration_intents;
create policy "gpe_event_registration_team_manage"
on public.gpe_event_registration_intents
for all
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

drop policy if exists "gpe_event_claim_read_own_or_team" on public.gpe_event_participation_claims;
create policy "gpe_event_claim_read_own_or_team"
on public.gpe_event_participation_claims
for select
using (
  hub_user_id = auth.uid()
  or public.can_manage_camp(auth.uid())
);

drop policy if exists "gpe_event_claim_team_manage" on public.gpe_event_participation_claims;
create policy "gpe_event_claim_team_manage"
on public.gpe_event_participation_claims
for all
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

drop policy if exists "gpe_event_sync_logs_team_read" on public.gpe_event_sync_logs;
create policy "gpe_event_sync_logs_team_read"
on public.gpe_event_sync_logs
for select
using (public.can_manage_camp(auth.uid()));

create or replace function public.emit_gpe_event_notification(
  p_event_type text,
  p_user_id uuid default null,
  p_event_id uuid default null,
  p_registration_intent_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
begin
  insert into public.gpe_notification_outbox (
    event_type,
    user_id,
    payload
  )
  values (
    p_event_type,
    p_user_id,
    jsonb_build_object(
      'event_id', p_event_id,
      'registration_intent_id', p_registration_intent_id,
      'details', coalesce(p_payload, '{}'::jsonb)
    )
  )
  returning id into created_id;
  return created_id;
end;
$$;
