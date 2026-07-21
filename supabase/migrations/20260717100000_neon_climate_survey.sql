do $$
begin
  if not exists (select 1 from pg_type where typname = 'neon_climate_submission_status') then
    create type public.neon_climate_submission_status as enum (
      'received',
      'requires_manual_review',
      'neon_sync_pending',
      'neon_synced',
      'hub_invite_pending',
      'hub_invited',
      'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'neon_climate_membership_outcome') then
    create type public.neon_climate_membership_outcome as enum (
      'active_member_existing_hub_user',
      'active_member_needs_hub_invite',
      'nonmember',
      'ambiguous_account',
      'submission_saved_neon_sync_pending',
      'failed'
    );
  end if;
end
$$;

create table if not exists public.neon_climate_survey_submissions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  survey_id integer not null default 2,
  form_id integer not null default 47,
  source_url text,
  normalized_email text,
  first_name text,
  last_name text,
  neon_account_id text,
  neon_activity_id text,
  supabase_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  sanitized_answers jsonb not null default '{}'::jsonb,
  status public.neon_climate_submission_status not null default 'received',
  membership_outcome public.neon_climate_membership_outcome,
  manual_review_reason text,
  neon_sync_attempts integer not null default 0,
  hub_invite_attempts integer not null default 0,
  last_error_summary text,
  submitted_at timestamptz,
  neon_synced_at timestamptz,
  hub_invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint neon_climate_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint neon_climate_answers_object check (jsonb_typeof(sanitized_answers) = 'object')
);

create table if not exists public.neon_climate_survey_retries (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.neon_climate_survey_submissions(id) on delete cascade,
  operation text not null,
  attempt_number integer not null,
  status text not null,
  safe_error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  neon_account_id text unique,
  normalized_email text,
  is_active boolean not null default false,
  membership_level text,
  membership_status text,
  starts_at date,
  expires_at date,
  source text not null default 'neon',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_invitations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.neon_climate_survey_submissions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  neon_account_id text,
  normalized_email text not null,
  status text not null default 'pending',
  invitation_token_hash text,
  sent_at timestamptz,
  accepted_at timestamptz,
  last_error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pending_membership_conversions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.neon_climate_survey_submissions(id) on delete cascade,
  normalized_email text not null,
  neon_account_id text,
  status text not null default 'pending_membership',
  membership_url text,
  converted_at timestamptz,
  hub_invitation_id uuid references public.hub_invitations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pending_membership_submission_unique unique (submission_id)
);

create index if not exists neon_climate_submissions_email_idx on public.neon_climate_survey_submissions (normalized_email);
create index if not exists neon_climate_submissions_neon_account_idx on public.neon_climate_survey_submissions (neon_account_id);
create index if not exists neon_climate_submissions_status_idx on public.neon_climate_survey_submissions (status);
create index if not exists neon_climate_retries_submission_idx on public.neon_climate_survey_retries (submission_id, created_at desc);
create index if not exists membership_access_email_idx on public.membership_access (normalized_email);
create index if not exists membership_access_user_idx on public.membership_access (user_id);
create index if not exists hub_invitations_email_idx on public.hub_invitations (normalized_email);
create index if not exists hub_invitations_status_idx on public.hub_invitations (status);
create index if not exists pending_membership_conversions_email_idx on public.pending_membership_conversions (normalized_email);

drop trigger if exists update_neon_climate_submissions_updated_at on public.neon_climate_survey_submissions;
create trigger update_neon_climate_submissions_updated_at
before update on public.neon_climate_survey_submissions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_membership_access_updated_at on public.membership_access;
create trigger update_membership_access_updated_at
before update on public.membership_access
for each row execute function public.update_updated_at_column();

drop trigger if exists update_hub_invitations_updated_at on public.hub_invitations;
create trigger update_hub_invitations_updated_at
before update on public.hub_invitations
for each row execute function public.update_updated_at_column();

drop trigger if exists update_pending_membership_conversions_updated_at on public.pending_membership_conversions;
create trigger update_pending_membership_conversions_updated_at
before update on public.pending_membership_conversions
for each row execute function public.update_updated_at_column();

alter table public.neon_climate_survey_submissions enable row level security;
alter table public.neon_climate_survey_retries enable row level security;
alter table public.membership_access enable row level security;
alter table public.hub_invitations enable row level security;
alter table public.pending_membership_conversions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'membership_access' and policyname = 'membership_access_user_read_own'
  ) then
    create policy "membership_access_user_read_own"
    on public.membership_access
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;
end
$$;
