begin;

alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists membership_pending_started_at timestamptz,
  add column if not exists membership_grace_expires_at timestamptz,
  add column if not exists membership_reminder_sent_at timestamptz,
  add column if not exists membership_deactivated_at timestamptz,
  add column if not exists membership_deactivation_reason text;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'deactivated'));

create index if not exists profiles_membership_grace_due_idx
  on public.profiles (membership_grace_expires_at)
  where membership_access_state = 'membership_pending'
    and account_status = 'active'
    and membership_grace_expires_at is not null;

create index if not exists profiles_membership_pending_reminder_idx
  on public.profiles (membership_reminder_sent_at, membership_grace_expires_at)
  where membership_access_state = 'membership_pending'
    and account_status = 'active';

update public.profiles
set
  membership_pending_started_at = coalesce(membership_pending_started_at, created_at, now()),
  membership_grace_expires_at = coalesce(membership_grace_expires_at, coalesce(created_at, now()) + interval '35 days'),
  updated_at = now()
where membership_access_state = 'membership_pending'
  and account_status = 'active'
  and (
    membership_pending_started_at is null
    or membership_grace_expires_at is null
  );

commit;
