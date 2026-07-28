alter table public.posts
  add column if not exists is_hidden boolean not null default false,
  add column if not exists is_removed boolean not null default false,
  add column if not exists moderation_status text not null default 'published';

alter table public.post_comments
  add column if not exists is_hidden boolean not null default false,
  add column if not exists is_removed boolean not null default false,
  add column if not exists moderation_status text not null default 'published';

alter table public.listings
  add column if not exists is_hidden boolean not null default false,
  add column if not exists moderation_status text not null default 'published';

alter table public.profiles
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderation_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_moderation_metadata_object'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_moderation_metadata_object
      check (jsonb_typeof(moderation_metadata) = 'object') not valid;
  end if;
end
$$;

alter table public.profiles validate constraint profiles_moderation_metadata_object;

create table if not exists public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reason text,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now(),
  constraint moderation_audit_target_type_check check (target_type in ('post', 'comment', 'listing', 'report', 'user')),
  constraint moderation_audit_state_objects check (
    (previous_state is null or jsonb_typeof(previous_state) = 'object')
    and (new_state is null or jsonb_typeof(new_state) = 'object')
  )
);

create index if not exists moderation_audit_target_created_idx
  on public.moderation_audit_log (target_type, target_id, created_at desc);

create index if not exists moderation_audit_moderator_created_idx
  on public.moderation_audit_log (moderator_id, created_at desc);

alter table public.moderation_audit_log enable row level security;

grant select, insert on public.moderation_audit_log to authenticated;

drop policy if exists "moderation_audit_admin_read" on public.moderation_audit_log;
create policy "moderation_audit_admin_read"
on public.moderation_audit_log
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "moderation_audit_admin_insert" on public.moderation_audit_log;
create policy "moderation_audit_admin_insert"
on public.moderation_audit_log
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create or replace function public.camp_admin_moderation_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_reason text default null
)
returns public.moderation_audit_log
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  old_state jsonb;
  new_state jsonb;
  audit_row public.moderation_audit_log;
  warning_entry jsonb;
begin
  if actor_id is null or not public.is_admin(actor_id) then
    raise exception 'Only admins can moderate Camp content';
  end if;

  if p_target_type not in ('post', 'comment', 'listing', 'report', 'user') then
    raise exception 'Unsupported moderation target type: %', p_target_type;
  end if;

  if p_action not in ('hide', 'restore', 'remove', 'resolve', 'dismiss', 'warn_user', 'suspend_user', 'restore_user') then
    raise exception 'Unsupported moderation action: %', p_action;
  end if;

  if p_target_type = 'post' then
    select to_jsonb(p) into old_state from public.posts p where p.id = p_target_id;
    if old_state is null then raise exception 'Post % not found', p_target_id; end if;

    if p_action = 'hide' then
      update public.posts set is_hidden = true, moderation_status = 'hidden', updated_at = now() where id = p_target_id;
    elsif p_action = 'restore' then
      update public.posts set is_hidden = false, is_removed = false, moderation_status = 'published', updated_at = now() where id = p_target_id;
    elsif p_action = 'remove' then
      update public.posts set is_removed = true, is_hidden = true, moderation_status = 'removed', updated_at = now() where id = p_target_id;
    else
      raise exception 'Action % is not valid for posts', p_action;
    end if;

    select to_jsonb(p) into new_state from public.posts p where p.id = p_target_id;
  elsif p_target_type = 'comment' then
    select to_jsonb(c) into old_state from public.post_comments c where c.id = p_target_id;
    if old_state is null then raise exception 'Comment % not found', p_target_id; end if;

    if p_action = 'hide' then
      update public.post_comments set is_hidden = true, moderation_status = 'hidden', updated_at = now() where id = p_target_id;
    elsif p_action = 'restore' then
      update public.post_comments set is_hidden = false, is_removed = false, moderation_status = 'published', updated_at = now() where id = p_target_id;
    elsif p_action = 'remove' then
      update public.post_comments set is_removed = true, is_hidden = true, moderation_status = 'removed', updated_at = now() where id = p_target_id;
    else
      raise exception 'Action % is not valid for comments', p_action;
    end if;

    select to_jsonb(c) into new_state from public.post_comments c where c.id = p_target_id;
  elsif p_target_type = 'listing' then
    select to_jsonb(l) into old_state from public.listings l where l.id = p_target_id;
    if old_state is null then raise exception 'Listing % not found', p_target_id; end if;

    if p_action = 'hide' then
      update public.listings set is_hidden = true, moderation_status = 'hidden', updated_at = now() where id = p_target_id;
    elsif p_action = 'restore' then
      update public.listings
      set is_hidden = false,
          is_removed = false,
          moderation_status = 'published',
          status = case when status = 'removed' then 'published'::public.listing_status else status end,
          updated_at = now()
      where id = p_target_id;
    elsif p_action = 'remove' then
      update public.listings
      set is_removed = true,
          is_hidden = true,
          moderation_status = 'removed',
          status = 'removed'::public.listing_status,
          updated_at = now()
      where id = p_target_id;
    else
      raise exception 'Action % is not valid for listings', p_action;
    end if;

    select to_jsonb(l) into new_state from public.listings l where l.id = p_target_id;
  elsif p_target_type = 'report' then
    select to_jsonb(f) into old_state from public.listing_flags f where f.id = p_target_id;
    if old_state is null then raise exception 'Report % not found', p_target_id; end if;

    if p_action in ('resolve', 'dismiss') then
      update public.listing_flags
      set resolved = true,
          resolved_at = now(),
          resolved_by = actor_id
      where id = p_target_id;
    else
      raise exception 'Action % is not valid for reports', p_action;
    end if;

    select to_jsonb(f) into new_state from public.listing_flags f where f.id = p_target_id;
  elsif p_target_type = 'user' then
    select to_jsonb(p) into old_state from public.profiles p where p.id = p_target_id;
    if old_state is null then raise exception 'User % not found', p_target_id; end if;

    warning_entry := jsonb_build_object(
      'reason', nullif(btrim(coalesce(p_reason, '')), ''),
      'moderator_id', actor_id,
      'created_at', now()
    );

    if p_action = 'warn_user' then
      update public.profiles
      set moderation_status = case when moderation_status = 'suspended' then moderation_status else 'warned' end,
          moderation_metadata = coalesce(moderation_metadata, '{}'::jsonb)
            || jsonb_build_object(
              'last_warning', warning_entry,
              'warnings', coalesce(moderation_metadata->'warnings', '[]'::jsonb) || jsonb_build_array(warning_entry)
            ),
          updated_at = now()
      where id = p_target_id;
    elsif p_action = 'suspend_user' then
      update public.profiles
      set moderation_status = 'suspended',
          moderation_metadata = coalesce(moderation_metadata, '{}'::jsonb)
            || jsonb_build_object('suspended_at', now(), 'suspended_by', actor_id, 'suspension_reason', nullif(btrim(coalesce(p_reason, '')), '')),
          updated_at = now()
      where id = p_target_id;
    elsif p_action = 'restore_user' then
      update public.profiles
      set moderation_status = 'active',
          moderation_metadata = coalesce(moderation_metadata, '{}'::jsonb)
            || jsonb_build_object('restored_at', now(), 'restored_by', actor_id, 'restore_reason', nullif(btrim(coalesce(p_reason, '')), '')),
          updated_at = now()
      where id = p_target_id;
    else
      raise exception 'Action % is not valid for users', p_action;
    end if;

    select to_jsonb(p) into new_state from public.profiles p where p.id = p_target_id;
  end if;

  insert into public.moderation_audit_log (
    moderator_id,
    action,
    target_type,
    target_id,
    reason,
    previous_state,
    new_state
  )
  values (
    actor_id,
    p_action,
    p_target_type,
    p_target_id,
    nullif(btrim(coalesce(p_reason, '')), ''),
    old_state,
    new_state
  )
  returning * into audit_row;

  return audit_row;
end;
$$;

revoke all on function public.camp_admin_moderation_action(text, text, uuid, text) from public;
grant execute on function public.camp_admin_moderation_action(text, text, uuid, text) to authenticated;
