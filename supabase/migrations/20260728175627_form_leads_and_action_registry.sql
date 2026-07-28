do $$
begin
  if not exists (select 1 from pg_type where typname = 'gpe_membership_choice') then
    create type public.gpe_membership_choice as enum (
      'not_offered',
      'accepted',
      'already_member',
      'skipped',
      'declined',
      'unknown'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gpe_action_points_status') then
    create type public.gpe_action_points_status as enum (
      'not_applicable',
      'pending_identity',
      'pending_membership',
      'awarded',
      'duplicate',
      'ineligible',
      'failed'
    );
  end if;
end
$$;

create table if not exists public.gpe_form_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  provider text not null,
  route_url text,
  destination_url text,
  provider_action_id text,
  campaign_slug text,
  source_page text,
  membership_prompt_enabled boolean not null default false,
  general_points integer not null default 0,
  camp_points integer not null default 0,
  hub_logging_enabled boolean not null default true,
  webhook_health text not null default 'unknown',
  neon_health text not null default 'unknown',
  last_successful_action_at timestamptz,
  status text not null default 'configured',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_form_registry_provider_check check (provider in ('action_network', 'neon_form', 'neon_survey', 'hub', 'wix_embed', 'external')),
  constraint gpe_form_registry_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.constituent_leads (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique,
  first_name text,
  last_name text,
  phone text,
  postal_code text,
  city text,
  state text,
  action_network_person_id text,
  neon_account_id text,
  hub_profile_id uuid references public.profiles(id) on delete set null,
  source text,
  membership_interest public.gpe_membership_choice not null default 'unknown',
  eligibility_affirmed boolean not null default false,
  consent_email boolean not null default false,
  consent_sms boolean not null default false,
  account_state text not null default 'lead',
  membership_state text not null default 'nonmember',
  hub_access text not null default 'restricted',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint constituent_leads_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.lead_actions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.constituent_leads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  action_slug text not null,
  provider text not null,
  provider_action_id text,
  provider_person_id text,
  provider_signature_id text,
  form_submission_id uuid references public.gpe_form_submissions(id) on delete set null,
  campaign_slug text,
  source_url text,
  membership_choice public.gpe_membership_choice not null default 'unknown',
  neon_sync_status public.gpe_form_sync_status not null default 'not_attempted',
  hub_identity_status public.gpe_form_sync_status not null default 'not_attempted',
  points_status public.gpe_action_points_status not null default 'not_applicable',
  points_result jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lead_actions_raw_payload_object check (jsonb_typeof(raw_payload) = 'object'),
  constraint lead_actions_points_result_object check (jsonb_typeof(points_result) = 'object')
);

create unique index if not exists lead_actions_provider_signature_unique
  on public.lead_actions (provider, provider_signature_id)
  where provider_signature_id is not null;

create unique index if not exists lead_actions_submission_unique
  on public.lead_actions (form_submission_id)
  where form_submission_id is not null;

create index if not exists gpe_form_registry_status_idx on public.gpe_form_registry (status, provider);
create index if not exists constituent_leads_neon_idx on public.constituent_leads (neon_account_id);
create index if not exists constituent_leads_action_network_idx on public.constituent_leads (action_network_person_id);
create index if not exists lead_actions_lead_created_idx on public.lead_actions (lead_id, occurred_at desc);
create index if not exists lead_actions_action_slug_idx on public.lead_actions (action_slug, occurred_at desc);
create index if not exists lead_actions_status_idx on public.lead_actions (membership_choice, neon_sync_status, hub_identity_status, points_status);

alter table public.gpe_form_submissions
  add column if not exists lead_id uuid references public.constituent_leads(id) on delete set null,
  add column if not exists action_slug text,
  add column if not exists action_type text,
  add column if not exists membership_choice public.gpe_membership_choice not null default 'unknown',
  add column if not exists points_status public.gpe_action_points_status not null default 'not_applicable';

create index if not exists gpe_form_submissions_lead_idx on public.gpe_form_submissions (lead_id);
create index if not exists gpe_form_submissions_action_slug_idx on public.gpe_form_submissions (action_slug, created_at desc);

drop trigger if exists update_gpe_form_registry_updated_at on public.gpe_form_registry;
create trigger update_gpe_form_registry_updated_at
before update on public.gpe_form_registry
for each row execute function public.update_updated_at_column();

drop trigger if exists update_constituent_leads_updated_at on public.constituent_leads;
create trigger update_constituent_leads_updated_at
before update on public.constituent_leads
for each row execute function public.update_updated_at_column();

alter table public.gpe_form_registry enable row level security;
alter table public.constituent_leads enable row level security;
alter table public.lead_actions enable row level security;

grant select on public.gpe_form_registry to authenticated;
grant select on public.constituent_leads to authenticated;
grant select on public.lead_actions to authenticated;

drop policy if exists "gpe_form_registry_admin_read" on public.gpe_form_registry;
create policy "gpe_form_registry_admin_read"
on public.gpe_form_registry
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "constituent_leads_admin_read" on public.constituent_leads;
create policy "constituent_leads_admin_read"
on public.constituent_leads
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "lead_actions_admin_read" on public.lead_actions;
create policy "lead_actions_admin_read"
on public.lead_actions
for select
to authenticated
using (public.is_admin(auth.uid()));

insert into public.gpe_form_registry (
  slug,
  title,
  provider,
  route_url,
  destination_url,
  provider_action_id,
  campaign_slug,
  source_page,
  membership_prompt_enabled,
  general_points,
  camp_points,
  status,
  metadata
)
values
  ('mobile-climate-adaptation-survey', 'Mobile Climate Adaptation Plan Survey', 'neon_survey', 'https://www.girlplusenvironment.org/mobile-climate-adaptation-survey#survey', 'https://www.girlplusenvironment.org/mobile-climate-adaptation-survey#survey', 'survey:2/form:47', 'mobile-climate-adaptation', 'mobile-climate-adaptation-survey.html', false, 0, 0, 'live', '{"edge_function":"neon-climate-survey"}'::jsonb),
  ('gpe-grad-highlight', 'GPE Grad Highlight', 'neon_form', 'https://www.girlplusenvironment.org/gpe-grad-highlight#submission', 'https://www.girlplusenvironment.org/gpe-grad-highlight#submission', null, 'gpe-grad-highlight', 'gpe-grad-highlight.html', true, 0, 0, 'wix_404', '{"edge_function":"gpe-grad-highlight-submit"}'::jsonb),
  ('camp-gpe', 'Camp GPE Registration', 'neon_form', 'https://www.girlplusenvironment.org/camp-gpe#submission', 'https://www.girlplusenvironment.org/camp-gpe#submission', null, 'camp-gpe', 'camp-gpe.html', true, 0, 0, 'live', '{"edge_function":"camp-gpe-submit"}'::jsonb),
  ('extreme-weather-action', 'Extreme Weather Action', 'action_network', 'https://www.girlplusenvironment.org/extreme-weather-action/', 'https://actionnetwork.org/letters/extreme-weather-puts-our-communities-at-risk-its-time-for-bold-climate-action-2', 'extreme-weather-puts-our-communities-at-risk-its-time-for-bold-climate-action-2', 'extreme-weather', 'extreme-weather-action.html', false, 5, 10, 'live', '{"completion_endpoint":"camp-gpe-challenge-submit"}'::jsonb)
on conflict (slug) do update set
  title = excluded.title,
  provider = excluded.provider,
  route_url = excluded.route_url,
  destination_url = excluded.destination_url,
  provider_action_id = excluded.provider_action_id,
  campaign_slug = excluded.campaign_slug,
  source_page = excluded.source_page,
  membership_prompt_enabled = excluded.membership_prompt_enabled,
  general_points = excluded.general_points,
  camp_points = excluded.camp_points,
  status = excluded.status,
  metadata = public.gpe_form_registry.metadata || excluded.metadata,
  updated_at = now();
