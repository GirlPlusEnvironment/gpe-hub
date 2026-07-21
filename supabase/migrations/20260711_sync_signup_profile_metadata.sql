create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
begin
  normalized_username := nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '');

  insert into public.profiles (
    id,
    username,
    full_name,
    avatar_url,
    bio,
    points
  )
  values (
    new.id,
    normalized_username,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.raw_user_meta_data ->> 'avatar_url',
    null,
    0
  )
  on conflict (id) do update
  set
    username = coalesce(public.profiles.username, excluded.username),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

update public.profiles as profiles
set
  username = coalesce(
    profiles.username,
    nullif(lower(trim(users.raw_user_meta_data ->> 'username')), '')
  ),
  full_name = coalesce(
    profiles.full_name,
    nullif(trim(users.raw_user_meta_data ->> 'full_name'), '')
  ),
  avatar_url = coalesce(
    profiles.avatar_url,
    users.raw_user_meta_data ->> 'avatar_url'
  ),
  updated_at = now()
from auth.users as users
where profiles.id = users.id
  and (
    profiles.username is null
    or profiles.full_name is null
    or profiles.avatar_url is null
  );
