create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type public.profile_role as enum ('user', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'listing_category') then
    create type public.listing_category as enum ('jobs', 'events', 'fundraisers', 'resources');
  end if;

  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type public.listing_status as enum ('draft', 'published', 'archived', 'pending_review', 'removed');
  end if;

  if not exists (select 1 from pg_type where typname = 'post_type') then
    create type public.post_type as enum ('text', 'poll');
  end if;
end
$$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  points integer not null default 0,
  role public.profile_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_points_nonnegative check (points >= 0)
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  category public.listing_category not null,
  title text not null,
  summary text,
  description text,
  image_url text,
  location text,
  tags text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  status public.listing_status not null default 'published',
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.listing_favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint listing_favorites_profile_listing_unique unique (profile_id, listing_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_content_not_blank check (length(btrim(content)) > 0)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  image_url text,
  type public.post_type not null default 'text',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  option_text text not null,
  created_at timestamptz not null default now(),
  constraint poll_options_option_text_not_blank check (length(btrim(option_text)) > 0)
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  poll_option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint poll_votes_post_user_unique unique (post_id, user_id)
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_likes_post_user_unique unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_content_not_blank check (length(btrim(content)) > 0)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group_chat boolean not null default false,
  name text,
  owner_id uuid references public.profiles(id) on delete set null,
  last_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  constraint conversation_participants_conversation_profile_unique unique (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  listing_id uuid references public.listings(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_has_payload check (
    content is not null or listing_id is not null or post_id is not null
  )
);

alter table public.conversations
  add constraint conversations_last_message_id_fkey
  foreign key (last_message_id)
  references public.messages(id)
  on delete set null;

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_earned integer not null,
  created_at timestamptz not null default now(),
  constraint point_transactions_nonzero check (points_earned <> 0)
);

create table if not exists public.listing_flags (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  flagged_by uuid references public.profiles(id) on delete set null,
  reason text,
  flagged_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_points_desc_idx on public.profiles (points desc);

create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_submitted_by_idx on public.listings (submitted_by);
create index if not exists listings_created_at_desc_idx on public.listings (created_at desc);
create index if not exists listings_removed_created_at_idx on public.listings (is_removed, created_at desc);
create index if not exists listings_category_removed_created_at_idx on public.listings (category, is_removed, created_at desc);
create index if not exists listings_tags_gin_idx on public.listings using gin (tags);
create index if not exists listings_metadata_gin_idx on public.listings using gin (metadata);

create index if not exists listing_favorites_listing_id_idx on public.listing_favorites (listing_id);

create index if not exists comments_listing_created_at_idx on public.comments (listing_id, created_at asc);
create index if not exists comments_user_id_idx on public.comments (user_id);

create index if not exists posts_created_at_desc_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_type_idx on public.posts (type);

create index if not exists poll_options_post_id_idx on public.poll_options (post_id);

create index if not exists poll_votes_poll_option_id_idx on public.poll_votes (poll_option_id);
create index if not exists poll_votes_user_id_idx on public.poll_votes (user_id);

create index if not exists post_likes_user_id_idx on public.post_likes (user_id);

create index if not exists post_comments_post_created_at_idx on public.post_comments (post_id, created_at asc);
create index if not exists post_comments_parent_id_idx on public.post_comments (parent_id);
create index if not exists post_comments_user_id_idx on public.post_comments (user_id);

create index if not exists conversations_updated_at_desc_idx on public.conversations (updated_at desc);
create index if not exists conversations_owner_id_idx on public.conversations (owner_id);
create index if not exists conversations_last_message_id_idx on public.conversations (last_message_id);

create index if not exists conversation_participants_profile_id_idx on public.conversation_participants (profile_id);
create index if not exists conversation_participants_profile_conversation_idx on public.conversation_participants (profile_id, conversation_id);

create index if not exists messages_conversation_created_at_desc_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_listing_id_idx on public.messages (listing_id);
create index if not exists messages_post_id_idx on public.messages (post_id);

create index if not exists point_transactions_user_created_at_desc_idx on public.point_transactions (user_id, created_at desc);
create index if not exists point_transactions_created_at_desc_idx on public.point_transactions (created_at desc);

create index if not exists listing_flags_listing_flagged_at_desc_idx on public.listing_flags (listing_id, flagged_at desc);
create index if not exists listing_flags_resolved_flagged_at_desc_idx on public.listing_flags (resolved, flagged_at desc);
create index if not exists listing_flags_flagged_by_idx on public.listing_flags (flagged_by);

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

create or replace function public.is_conversation_participant(check_conversation_id uuid, check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = check_conversation_id
      and profile_id = check_user_id
  );
$$;

create or replace function public.validate_poll_vote_option()
returns trigger
language plpgsql
as $$
declare
  option_post_id uuid;
begin
  select post_id into option_post_id
  from public.poll_options
  where id = new.poll_option_id;

  if option_post_id is null then
    raise exception 'Poll option % does not exist', new.poll_option_id;
  end if;

  if option_post_id <> new.post_id then
    raise exception 'Poll option % does not belong to post %', new.poll_option_id, new.post_id;
  end if;

  return new;
end;
$$;

create or replace function public.validate_post_comment_parent()
returns trigger
language plpgsql
as $$
declare
  parent_post_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select post_id into parent_post_id
  from public.post_comments
  where id = new.parent_id;

  if parent_post_id is null then
    raise exception 'Parent comment % does not exist', new.parent_id;
  end if;

  if parent_post_id <> new.post_id then
    raise exception 'Parent comment % belongs to a different post', new.parent_id;
  end if;

  return new;
end;
$$;

create or replace function public.guard_conversation_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if old.name is distinct from new.name
     or old.owner_id is distinct from new.owner_id
     or old.is_group_chat is distinct from new.is_group_chat then
    if old.owner_id is distinct from auth.uid() then
      raise exception 'Only the group owner can modify conversation settings';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_id = new.id,
      updated_at = greatest(coalesce(updated_at, new.created_at), new.created_at)
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at
before update on public.listings
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
before update on public.comments
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_post_comments_updated_at on public.post_comments;
create trigger set_post_comments_updated_at
before update on public.post_comments
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
before update on public.messages
for each row
execute function public.update_updated_at_column();

drop trigger if exists validate_poll_vote_option_trigger on public.poll_votes;
create trigger validate_poll_vote_option_trigger
before insert or update on public.poll_votes
for each row
execute function public.validate_poll_vote_option();

drop trigger if exists validate_post_comment_parent_trigger on public.post_comments;
create trigger validate_post_comment_parent_trigger
before insert or update on public.post_comments
for each row
execute function public.validate_post_comment_parent();

drop trigger if exists guard_conversation_updates_trigger on public.conversations;
create trigger guard_conversation_updates_trigger
before update on public.conversations
for each row
execute function public.guard_conversation_updates();

drop trigger if exists sync_conversation_last_message_trigger on public.messages;
create trigger sync_conversation_last_message_trigger
after insert on public.messages
for each row
execute function public.sync_conversation_last_message();

alter table public.profiles replica identity full;
alter table public.conversations replica identity full;
alter table public.conversation_participants replica identity full;
alter table public.messages replica identity full;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_favorites enable row level security;
alter table public.comments enable row level security;
alter table public.posts enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.point_transactions enable row level security;
alter table public.listing_flags enable row level security;

create policy "profiles_select_public_profile"
on public.profiles
for select
using (true);

create policy "profiles_insert_own_profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own_profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_admin_read_all"
on public.profiles
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "listings_select_visible"
on public.listings
for select
using (is_removed = false);

create policy "listings_select_admin_all"
on public.listings
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "listings_insert_own"
on public.listings
for insert
to authenticated
with check (submitted_by = auth.uid());

create policy "listings_update_owner"
on public.listings
for update
to authenticated
using (submitted_by = auth.uid())
with check (submitted_by = auth.uid());

create policy "listings_update_admin"
on public.listings
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "listings_delete_owner"
on public.listings
for delete
to authenticated
using (submitted_by = auth.uid());

create policy "listings_delete_admin"
on public.listings
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "listing_favorites_select_own"
on public.listing_favorites
for select
to authenticated
using (profile_id = auth.uid());

create policy "listing_favorites_insert_own"
on public.listing_favorites
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "listing_favorites_delete_own"
on public.listing_favorites
for delete
to authenticated
using (profile_id = auth.uid());

create policy "comments_select_all"
on public.comments
for select
using (true);

create policy "comments_insert_own"
on public.comments
for insert
to authenticated
with check (user_id = auth.uid());

create policy "comments_update_own"
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "comments_delete_own"
on public.comments
for delete
to authenticated
using (user_id = auth.uid());

create policy "comments_admin_delete_all"
on public.comments
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "posts_select_all"
on public.posts
for select
using (true);

create policy "posts_insert_own"
on public.posts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "posts_update_own"
on public.posts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "posts_delete_own"
on public.posts
for delete
to authenticated
using (user_id = auth.uid());

create policy "posts_admin_delete_all"
on public.posts
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "poll_options_select_all"
on public.poll_options
for select
using (true);

create policy "poll_options_insert_post_owner"
on public.poll_options
for insert
to authenticated
with check (
  exists (
    select 1
    from public.posts
    where posts.id = poll_options.post_id
      and posts.user_id = auth.uid()
  )
);

create policy "poll_options_update_post_owner"
on public.poll_options
for update
to authenticated
using (
  exists (
    select 1
    from public.posts
    where posts.id = poll_options.post_id
      and posts.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.posts
    where posts.id = poll_options.post_id
      and posts.user_id = auth.uid()
  )
);

create policy "poll_options_delete_post_owner"
on public.poll_options
for delete
to authenticated
using (
  exists (
    select 1
    from public.posts
    where posts.id = poll_options.post_id
      and posts.user_id = auth.uid()
  )
);

create policy "poll_votes_select_all"
on public.poll_votes
for select
using (true);

create policy "poll_votes_insert_own"
on public.poll_votes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "poll_votes_delete_own"
on public.poll_votes
for delete
to authenticated
using (user_id = auth.uid());

create policy "post_likes_select_all"
on public.post_likes
for select
using (true);

create policy "post_likes_insert_own"
on public.post_likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "post_likes_delete_own"
on public.post_likes
for delete
to authenticated
using (user_id = auth.uid());

create policy "post_comments_select_all"
on public.post_comments
for select
using (true);

create policy "post_comments_insert_own"
on public.post_comments
for insert
to authenticated
with check (user_id = auth.uid());

create policy "post_comments_update_own"
on public.post_comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "post_comments_delete_own"
on public.post_comments
for delete
to authenticated
using (user_id = auth.uid());

create policy "post_comments_admin_delete_all"
on public.post_comments
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "conversations_select_participant"
on public.conversations
for select
to authenticated
using (public.is_conversation_participant(id, auth.uid()));

create policy "conversations_insert_authenticated"
on public.conversations
for insert
to authenticated
with check (
  owner_id is null
  or owner_id = auth.uid()
  or public.is_admin(auth.uid())
);

create policy "conversations_update_participant"
on public.conversations
for update
to authenticated
using (public.is_conversation_participant(id, auth.uid()))
with check (public.is_conversation_participant(id, auth.uid()));

create policy "conversations_update_group_owner"
on public.conversations
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin(auth.uid()))
with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

create policy "conversations_delete_admin_only"
on public.conversations
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "conversation_participants_select_participant"
on public.conversation_participants
for select
to authenticated
using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "conversation_participants_insert_group_owner_or_creator"
on public.conversation_participants
for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.conversations
    where conversations.id = conversation_participants.conversation_id
      and conversations.owner_id = auth.uid()
  )
);

create policy "conversation_participants_update_own_read_state"
on public.conversation_participants
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "conversation_participants_delete_self_or_group_owner"
on public.conversation_participants
for delete
to authenticated
using (
  profile_id = auth.uid()
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from public.conversations
    where conversations.id = conversation_participants.conversation_id
      and conversations.owner_id = auth.uid()
  )
);

create policy "messages_select_participant"
on public.messages
for select
to authenticated
using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "messages_insert_participant_sender"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id, auth.uid())
);

create policy "messages_update_sender"
on public.messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create policy "messages_delete_admin_only"
on public.messages
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "point_transactions_select_own"
on public.point_transactions
for select
to authenticated
using (user_id = auth.uid());

create policy "point_transactions_insert_own_or_rpc"
on public.point_transactions
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "point_transactions_admin_read_all"
on public.point_transactions
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "listing_flags_select_admin_only"
on public.listing_flags
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "listing_flags_insert_admin_only_or_rpc"
on public.listing_flags
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "listing_flags_update_admin_only_or_rpc"
on public.listing_flags
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create or replace function public.increment_user_points(user_id_param uuid, points_to_add integer)
returns table (user_id uuid, new_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_points integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if auth.uid() <> user_id_param and not public.is_admin(auth.uid()) then
    raise exception 'Not authorized to modify points for this user';
  end if;

  update public.profiles
  set points = greatest(0, points + points_to_add),
      updated_at = now()
  where id = user_id_param
  returning profiles.points into updated_points;

  if updated_points is null then
    raise exception 'Profile % not found', user_id_param;
  end if;

  return query
  select user_id_param, updated_points;
end;
$$;

create or replace function public.flag_listing(p_listing_id uuid, p_reason text default null)
returns public.listing_flags
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_flag public.listing_flags;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Only admins can flag listings';
  end if;

  insert into public.listing_flags (listing_id, flagged_by, reason)
  values (p_listing_id, auth.uid(), p_reason)
  returning * into inserted_flag;

  return inserted_flag;
end;
$$;

create or replace function public.resolve_flags_for_listing(p_listing_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Only admins can resolve listing flags';
  end if;

  update public.listing_flags
  set resolved = true,
      resolved_at = now(),
      resolved_by = auth.uid()
  where listing_id = p_listing_id
    and resolved = false;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

create or replace function public.remove_listing(p_listing_id uuid)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_listing public.listings;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Only admins can remove listings';
  end if;

  update public.listings
  set is_removed = true,
      status = 'removed',
      updated_at = now()
  where id = p_listing_id
  returning * into updated_listing;

  if updated_listing.id is null then
    raise exception 'Listing % not found', p_listing_id;
  end if;

  return updated_listing;
end;
$$;

create or replace function public.restore_listing(p_listing_id uuid)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_listing public.listings;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Only admins can restore listings';
  end if;

  update public.listings
  set is_removed = false,
      status = case when status = 'removed' then 'published' else status end,
      updated_at = now()
  where id = p_listing_id
  returning * into updated_listing;

  if updated_listing.id is null then
    raise exception 'Listing % not found', p_listing_id;
  end if;

  return updated_listing;
end;
$$;

grant execute on function public.increment_user_points(uuid, integer) to authenticated;
grant execute on function public.flag_listing(uuid, text) to authenticated;
grant execute on function public.resolve_flags_for_listing(uuid) to authenticated;
grant execute on function public.remove_listing(uuid) to authenticated;
grant execute on function public.restore_listing(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('event-images', 'event-images', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('post-images', 'post-images', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_public_read"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "avatars_authenticated_upload_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_authenticated_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_authenticated_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "event_images_public_read"
on storage.objects
for select
using (bucket_id = 'event-images');

create policy "event_images_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'event-images');

create policy "event_images_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'event-images')
with check (bucket_id = 'event-images');

create policy "event_images_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'event-images');

create policy "post_images_public_read"
on storage.objects
for select
using (bucket_id = 'post-images');

create policy "post_images_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'post-images');

create policy "post_images_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'post-images')
with check (bucket_id = 'post-images');

create policy "post_images_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'post-images');

do $$
declare
  seed_profile_id uuid;
begin
  select id into seed_profile_id
  from public.profiles
  order by created_at asc
  limit 1;

  if seed_profile_id is not null and not exists (select 1 from public.listings) then
    insert into public.listings (
      category,
      title,
      summary,
      description,
      image_url,
      location,
      tags,
      metadata,
      status,
      submitted_by
    )
    values
      (
        'jobs',
        'Community Climate Organizer',
        'Organize local climate justice campaigns and member outreach.',
        'Lead campaigns, coordinate volunteers, and support community strategy for climate justice work.',
        'https://images.unsplash.com/photo-1551836022-4c4c79ecde51?w=900&h=600&fit=crop',
        'Chicago, IL',
        array['Climate Justice', 'Community', 'Remote'],
        jsonb_build_object(
          'location', 'Chicago, IL',
          'state', 'Illinois',
          'job_type', 'Full-time',
          'work_arrangements', jsonb_build_array('Remote', 'Full-time'),
          'experience_level', 'Mid-level',
          'salary', '$50,000 - $75,000',
          'company', 'South Side Climate Network',
          'industry', 'Environmental/Climate Justice',
          'requirements', jsonb_build_array('Community organizing experience', 'Strong communication skills'),
          'benefits', jsonb_build_array('Health insurance', 'Flexible schedule'),
          'application_deadline', '2026-08-15',
          'contact_email', 'jobs@example.org',
          'application_url', 'https://example.org/jobs/community-climate-organizer'
        ),
        'published',
        seed_profile_id
      ),
      (
        'events',
        'Environmental Justice Summit',
        'A one-day gathering for organizers, researchers, and students.',
        'Join workshops, panels, and networking sessions focused on environmental justice strategy and coalition building.',
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&h=600&fit=crop',
        'Atlanta, GA',
        array['Conference', 'Networking', 'Justice'],
        jsonb_build_object(
          'organizer', 'Girl + Environment',
          'event_type', 'Conference',
          'date', '2026-09-20',
          'time', '10:00 AM',
          'cost', 'Free',
          'location', 'Atlanta, GA',
          'contact_email', 'events@example.org',
          'registration_url', 'https://example.org/events/ej-summit',
          'agenda', jsonb_build_array('Opening keynote', 'Youth panel', 'Community workshops'),
          'max_attendees', 300
        ),
        'published',
        seed_profile_id
      ),
      (
        'fundraisers',
        'Youth Climate Action Microgrant',
        'Small grants for local environmental justice projects.',
        'Funding is available for youth-led mutual aid, organizing, and climate resilience projects.',
        'https://images.unsplash.com/photo-1521737604893-96fceff52b22?w=900&h=600&fit=crop',
        null,
        array['Education', 'Legal', 'Environment'],
        jsonb_build_object(
          'source', 'Regional Climate Fund',
          'funding_type', 'Grant',
          'amount', '$10,000',
          'goal_amount', '$10,000',
          'current_amount', '$4,000',
          'deadline', '2026-10-01',
          'link', 'https://example.org/funding/youth-microgrant',
          'donation_url', 'https://example.org/funding/youth-microgrant',
          'contact_email', 'funding@example.org',
          'notes', 'Priority for frontline communities',
          'organizer', 'Regional Climate Fund',
          'updates', jsonb_build_array('Applications open now'),
          'progress_percentage', 40
        ),
        'published',
        seed_profile_id
      ),
      (
        'resources',
        'Environmental Justice Starter Toolkit',
        'Templates, readings, and videos for new organizers.',
        'A curated toolkit for students and community members learning environmental justice fundamentals.',
        'https://images.unsplash.com/photo-1450101215322-bf5cd27642fc?w=900&h=600&fit=crop',
        null,
        array['Toolkit', 'Beginner', 'Training'],
        jsonb_build_object(
          'source', 'Community Learning Lab',
          'resource_category', 'Toolkit',
          'resource_type', 'Toolkit',
          'author', 'Community Learning Lab',
          'topic', 'Environmental Justice',
          'difficulty_level', 'Beginner',
          'link', 'https://example.org/resources/ej-toolkit',
          'download_url', 'https://example.org/resources/ej-toolkit',
          'notes', 'Includes worksheets and templates',
          'last_updated', '2026-06-15',
          'file_size', '12 MB'
        ),
        'published',
        seed_profile_id
      );
  end if;
end
$$;
