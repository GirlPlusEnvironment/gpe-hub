do $$
begin
  if not exists (select 1 from pg_type where typname = 'gpe_form_submission_status') then
    create type public.gpe_form_submission_status as enum (
      'received',
      'validated',
      'duplicate',
      'processing',
      'completed',
      'partial_failure',
      'failed',
      'requires_manual_review'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'gpe_form_sync_status') then
    create type public.gpe_form_sync_status as enum (
      'not_attempted',
      'pending',
      'succeeded',
      'failed',
      'skipped'
    );
  end if;
end
$$;

create table if not exists public.gpe_form_submissions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  form_key text not null,
  schema_version integer not null default 1,
  email_normalized text,
  neon_account_id text,
  membership_outcome text,
  submission_payload jsonb not null default '{}'::jsonb,
  membership_request jsonb,
  submission_status public.gpe_form_submission_status not null default 'received',
  neon_sync_status public.gpe_form_sync_status not null default 'not_attempted',
  hub_invitation_status public.gpe_form_sync_status not null default 'not_attempted',
  honeypot_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_form_payload_object check (jsonb_typeof(submission_payload) = 'object'),
  constraint gpe_form_membership_request_object check (membership_request is null or jsonb_typeof(membership_request) = 'object')
);

create table if not exists public.gpe_form_sync_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.gpe_form_submissions(id) on delete cascade,
  integration text not null,
  operation text not null,
  success boolean not null default false,
  status_code integer,
  response_summary text,
  error_summary text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.gpe_form_registrations (
  id uuid primary key default gen_random_uuid(),
  form_key text not null,
  email_normalized text not null,
  neon_account_id text,
  external_registration_id text,
  registration_status text not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_form_registration_unique unique (form_key, email_normalized)
);

create index if not exists gpe_form_submissions_form_created_idx on public.gpe_form_submissions (form_key, created_at desc);
create index if not exists gpe_form_submissions_email_idx on public.gpe_form_submissions (email_normalized);
create index if not exists gpe_form_submissions_neon_account_idx on public.gpe_form_submissions (neon_account_id);
create index if not exists gpe_form_submissions_status_idx on public.gpe_form_submissions (submission_status, neon_sync_status);
create index if not exists gpe_form_sync_logs_submission_idx on public.gpe_form_sync_logs (submission_id, created_at desc);
create index if not exists gpe_form_sync_logs_integration_idx on public.gpe_form_sync_logs (integration, operation, created_at desc);
create index if not exists gpe_form_registrations_email_idx on public.gpe_form_registrations (email_normalized);
create index if not exists gpe_form_registrations_form_status_idx on public.gpe_form_registrations (form_key, registration_status);

drop trigger if exists update_gpe_form_submissions_updated_at on public.gpe_form_submissions;
create trigger update_gpe_form_submissions_updated_at
before update on public.gpe_form_submissions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gpe_form_registrations_updated_at on public.gpe_form_registrations;
create trigger update_gpe_form_registrations_updated_at
before update on public.gpe_form_registrations
for each row execute function public.update_updated_at_column();

alter table public.gpe_form_submissions enable row level security;
alter table public.gpe_form_sync_logs enable row level security;
alter table public.gpe_form_registrations enable row level security;
