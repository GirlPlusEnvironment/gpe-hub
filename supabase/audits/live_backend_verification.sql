-- Read-only verification queries for the linked Supabase project.
-- Use these in the SQL editor before cutover if CLI access cannot inspect live state.

-- Tables and replica identity
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relreplident as replica_identity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'messages', 'conversations', 'conversation_participants')
order by c.relname;

-- Realtime publication membership
select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('profiles', 'messages', 'conversations', 'conversation_participants')
order by tablename;

-- Storage buckets
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('avatars', 'event-images', 'post-images')
order by id;

-- Storage policies
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'avatars_public_read',
    'avatars_authenticated_upload_own_folder',
    'avatars_authenticated_update_own_folder',
    'avatars_authenticated_delete_own_folder',
    'event_images_public_read',
    'event_images_authenticated_upload',
    'event_images_authenticated_update',
    'event_images_authenticated_delete',
    'post_images_public_read',
    'post_images_authenticated_upload',
    'post_images_authenticated_update',
    'post_images_authenticated_delete'
  )
order by policyname;

-- Auth profile trigger
select trigger_name, event_manipulation, event_object_schema, event_object_table, action_statement
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
  and trigger_name = 'on_auth_user_created';

-- Backfill gaps between auth.users and public.profiles
select users.id, users.email
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null;

-- RPC signatures
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'increment_user_points',
    'flag_listing',
    'resolve_flags_for_listing',
    'remove_listing',
    'restore_listing'
  )
order by p.proname;

-- RLS policies for launch-critical tables
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'listings',
    'listing_favorites',
    'posts',
    'post_comments',
    'post_likes',
    'poll_options',
    'poll_votes',
    'conversations',
    'conversation_participants',
    'messages',
    'listing_flags',
    'point_transactions'
  )
order by tablename, policyname;
