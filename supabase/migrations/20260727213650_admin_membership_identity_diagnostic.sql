create or replace function public.admin_get_membership_identity_diagnostic(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  profile_row public.profiles%rowtype;
  access_row public.membership_access%rowtype;
  auth_user_exists boolean := false;
  auth_user_id uuid := null;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Admin access required.';
  end if;

  if normalized = '' or normalized !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email is required.';
  end if;

  select u.id, true
  into auth_user_id, auth_user_exists
  from auth.users u
  where lower(u.email) = normalized
  order by u.created_at desc
  limit 1;

  select p.*
  into profile_row
  from public.profiles p
  where lower(p.email) = normalized
     or p.id = auth_user_id
  order by
    case when p.id = auth_user_id then 0 else 1 end,
    p.updated_at desc nulls last
  limit 1;

  select ma.*
  into access_row
  from public.membership_access ma
  where ma.normalized_email = normalized
     or (auth_user_id is not null and ma.user_id = auth_user_id)
     or (profile_row.neon_account_id is not null and ma.neon_account_id = profile_row.neon_account_id)
  order by
    case
      when auth_user_id is not null and ma.user_id = auth_user_id then 0
      when profile_row.neon_account_id is not null and ma.neon_account_id = profile_row.neon_account_id then 1
      else 2
    end,
    ma.last_verified_at desc nulls last,
    ma.updated_at desc nulls last
  limit 1;

  return jsonb_build_object(
    'email', normalized,
    'auth', jsonb_build_object(
      'exists', coalesce(auth_user_exists, false),
      'userId', auth_user_id
    ),
    'profile', case
      when profile_row.id is null then null
      else jsonb_build_object(
        'id', profile_row.id,
        'email', profile_row.email,
        'neonAccountId', profile_row.neon_account_id,
        'memberStatus', profile_row.member_status,
        'membershipAccessState', profile_row.membership_access_state,
        'membershipLevel', profile_row.membership_level,
        'membershipStartDate', profile_row.membership_start_date,
        'membershipEndDate', profile_row.membership_end_date,
        'membershipLastSyncedAt', profile_row.membership_last_synced_at,
        'updatedAt', profile_row.updated_at
      )
    end,
    'membershipAccess', case
      when access_row.id is null then null
      else jsonb_build_object(
        'id', access_row.id,
        'userId', access_row.user_id,
        'normalizedEmail', access_row.normalized_email,
        'neonAccountId', access_row.neon_account_id,
        'isActive', access_row.is_active,
        'accessState', access_row.access_state,
        'membershipStatus', access_row.membership_status,
        'membershipLevel', access_row.membership_level,
        'startsAt', access_row.starts_at,
        'expiresAt', access_row.expires_at,
        'lastVerifiedAt', access_row.last_verified_at,
        'updatedAt', access_row.updated_at
      )
    end
  );
end;
$$;

revoke all on function public.admin_get_membership_identity_diagnostic(text) from public;
grant execute on function public.admin_get_membership_identity_diagnostic(text) to authenticated;
