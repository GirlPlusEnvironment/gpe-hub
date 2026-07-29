begin;

alter table public.profiles
  add column if not exists membership_status text,
  add column if not exists membership_grace_started_at timestamptz,
  add column if not exists membership_deadline_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'deactivated', 'deletion_scheduled', 'deleted', 'deletion_failed'));

create table if not exists public.hub_membership_reminder_attempts (
  id uuid primary key default gen_random_uuid(),
  hub_profile_id uuid references public.profiles(id) on delete set null,
  reminder_number integer not null check (reminder_number between 1 and 5),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  resend_message_id text,
  delivery_status text not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hub_profile_id, reminder_number)
);

create table if not exists public.hub_membership_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  hub_profile_id uuid,
  auth_user_id uuid,
  normalized_email text,
  action text not null,
  result text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.hub_membership_reminder_attempts enable row level security;
alter table public.hub_membership_deletion_audit enable row level security;

create index if not exists hub_membership_reminders_profile_idx
  on public.hub_membership_reminder_attempts (hub_profile_id, reminder_number);

create index if not exists hub_membership_reminders_due_idx
  on public.hub_membership_reminder_attempts (scheduled_for, delivery_status);

create index if not exists hub_membership_deletion_audit_profile_idx
  on public.hub_membership_deletion_audit (hub_profile_id, created_at desc);

create index if not exists profiles_membership_deadline_idx
  on public.profiles (membership_deadline_at)
  where membership_access_state = 'membership_pending'
    and account_status = 'active';

update public.profiles
set
  membership_status = coalesce(membership_status, member_status, case when membership_access_state = 'membership_pending' then 'pending' end),
  membership_grace_started_at = coalesce(membership_grace_started_at, membership_pending_started_at, created_at, now()),
  membership_deadline_at = coalesce(membership_deadline_at, coalesce(membership_pending_started_at, created_at, now()) + interval '35 days'),
  membership_pending_started_at = coalesce(membership_pending_started_at, membership_grace_started_at, created_at, now()),
  membership_grace_expires_at = coalesce(membership_deadline_at, coalesce(membership_pending_started_at, created_at, now()) + interval '35 days', membership_grace_expires_at),
  updated_at = now()
where membership_access_state = 'membership_pending'
  and account_status = 'active';

commit;
