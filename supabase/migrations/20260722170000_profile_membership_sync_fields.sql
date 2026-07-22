begin;

alter table public.profiles
  add column if not exists membership_level text,
  add column if not exists membership_start_date date,
  add column if not exists membership_end_date date,
  add column if not exists membership_last_synced_at timestamptz,
  add column if not exists membership_access_state text;

alter table public.membership_access
  add column if not exists access_state text;

create index if not exists profiles_membership_access_state_idx
  on public.profiles (membership_access_state)
  where membership_access_state is not null;

create index if not exists membership_access_state_idx
  on public.membership_access (access_state)
  where access_state is not null;

update public.profiles p
set
  membership_level = coalesce(p.membership_level, ma.membership_level),
  membership_start_date = coalesce(p.membership_start_date, ma.starts_at),
  membership_end_date = coalesce(p.membership_end_date, ma.expires_at),
  membership_last_synced_at = coalesce(p.membership_last_synced_at, ma.last_verified_at),
  membership_access_state = coalesce(
    p.membership_access_state,
    case
      when ma.is_active then 'active'
      when ma.expires_at is not null and ma.expires_at < current_date then 'expired'
      when ma.neon_account_id is not null then 'inactive'
      else null
    end
  ),
  member_status = coalesce(
    p.member_status,
    case
      when ma.is_active then 'active'
      when ma.expires_at is not null and ma.expires_at < current_date then 'expired'
      when ma.neon_account_id is not null then 'inactive'
      else null
    end
  ),
  updated_at = now()
from public.membership_access ma
where (
    ma.user_id = p.id
    or (
      ma.normalized_email is not null
      and p.email is not null
      and ma.normalized_email = lower(p.email)
    )
  )
  and (
    p.membership_level is null
    or p.membership_start_date is null
    or p.membership_end_date is null
    or p.membership_last_synced_at is null
    or p.membership_access_state is null
    or p.member_status is null
  );

update public.membership_access
set
  access_state = case
    when is_active then 'active'
    when expires_at is not null and expires_at < current_date then 'expired'
    when neon_account_id is not null then 'inactive'
    else 'unknown'
  end,
  updated_at = now()
where access_state is null;

commit;
