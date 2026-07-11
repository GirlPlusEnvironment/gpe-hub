create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url',
    null,
    0
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

insert into public.profiles (
  id,
  username,
  full_name,
  avatar_url,
  bio,
  points
)
select
  users.id,
  null,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.email),
  users.raw_user_meta_data ->> 'avatar_url',
  null,
  0
from auth.users as users
left join public.profiles as profiles
  on profiles.id = users.id
where profiles.id is null;
