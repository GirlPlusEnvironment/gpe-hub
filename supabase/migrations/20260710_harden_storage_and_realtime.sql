insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('event-images', 'event-images', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('post-images', 'post-images', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_images_authenticated_upload'
  ) then
    execute 'drop policy "event_images_authenticated_upload" on storage.objects';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_images_authenticated_update'
  ) then
    execute 'drop policy "event_images_authenticated_update" on storage.objects';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_images_authenticated_delete'
  ) then
    execute 'drop policy "event_images_authenticated_delete" on storage.objects';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_authenticated_upload'
  ) then
    execute 'drop policy "post_images_authenticated_upload" on storage.objects';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_authenticated_update'
  ) then
    execute 'drop policy "post_images_authenticated_update" on storage.objects';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_authenticated_delete'
  ) then
    execute 'drop policy "post_images_authenticated_delete" on storage.objects';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_public_read'
  ) then
    execute $policy$
      create policy "avatars_public_read"
      on storage.objects
      for select
      using (bucket_id = 'avatars')
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_authenticated_upload_own_folder'
  ) then
    execute $policy$
      create policy "avatars_authenticated_upload_own_folder"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_authenticated_update_own_folder'
  ) then
    execute $policy$
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
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_authenticated_delete_own_folder'
  ) then
    execute $policy$
      create policy "avatars_authenticated_delete_own_folder"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_images_public_read'
  ) then
    execute $policy$
      create policy "event_images_public_read"
      on storage.objects
      for select
      using (bucket_id = 'event-images')
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_images_authenticated_upload'
  ) then
    execute $policy$
      create policy "event_images_authenticated_upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'event-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_images_authenticated_update'
  ) then
    execute $policy$
      create policy "event_images_authenticated_update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'event-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'event-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_images_authenticated_delete'
  ) then
    execute $policy$
      create policy "event_images_authenticated_delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'event-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_public_read'
  ) then
    execute $policy$
      create policy "post_images_public_read"
      on storage.objects
      for select
      using (bucket_id = 'post-images')
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_authenticated_upload'
  ) then
    execute $policy$
      create policy "post_images_authenticated_upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'post-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_authenticated_update'
  ) then
    execute $policy$
      create policy "post_images_authenticated_update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'post-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'post-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'post_images_authenticated_delete'
  ) then
    execute $policy$
      create policy "post_images_authenticated_delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'post-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
  end if;
end
$$;

alter table public.profiles replica identity full;
alter table public.conversations replica identity full;
alter table public.conversation_participants replica identity full;
alter table public.messages replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversations'
    ) then
      alter publication supabase_realtime add table public.conversations;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversation_participants'
    ) then
      alter publication supabase_realtime add table public.conversation_participants;
    end if;
  end if;
end
$$;
