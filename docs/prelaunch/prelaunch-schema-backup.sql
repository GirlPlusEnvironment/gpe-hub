


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."listing_category" AS ENUM (
    'jobs',
    'events',
    'fundraisers',
    'resources'
);


ALTER TYPE "public"."listing_category" OWNER TO "postgres";


CREATE TYPE "public"."listing_status" AS ENUM (
    'draft',
    'published',
    'archived',
    'pending_review',
    'removed'
);


ALTER TYPE "public"."listing_status" OWNER TO "postgres";


CREATE TYPE "public"."post_type" AS ENUM (
    'text',
    'poll'
);


ALTER TYPE "public"."post_type" OWNER TO "postgres";


CREATE TYPE "public"."profile_role" AS ENUM (
    'user',
    'admin'
);


ALTER TYPE "public"."profile_role" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."listing_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "flagged_by" "uuid",
    "reason" "text",
    "flagged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid"
);


ALTER TABLE "public"."listing_flags" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flag_listing"("p_listing_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."listing_flags"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."flag_listing"("p_listing_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_conversation_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."guard_conversation_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_user_points"("user_id_param" "uuid", "points_to_add" integer) RETURNS TABLE("user_id" "uuid", "new_points" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."increment_user_points"("user_id_param" "uuid", "points_to_add" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("check_conversation_id" "uuid", "check_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = check_conversation_id
      and profile_id = check_user_id
  );
$$;


ALTER FUNCTION "public"."is_conversation_participant"("check_conversation_id" "uuid", "check_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "public"."listing_category" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "description" "text",
    "image_url" "text",
    "location" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "public"."listing_status" DEFAULT 'published'::"public"."listing_status" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "is_removed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "listings_metadata_object" CHECK (("jsonb_typeof"("metadata") = 'object'::"text"))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_listing"("p_listing_id" "uuid") RETURNS "public"."listings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."remove_listing"("p_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_flags_for_listing"("p_listing_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."resolve_flags_for_listing"("p_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_listing"("p_listing_id" "uuid") RETURNS "public"."listings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."restore_listing"("p_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.conversations
  set last_message_id = new.id,
      updated_at = greatest(coalesce(updated_at, new.created_at), new.created_at)
  where id = new.conversation_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_poll_vote_option"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."validate_poll_vote_option"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_post_comment_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."validate_post_comment_parent"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comments_content_not_blank" CHECK (("length"("btrim"("content")) > 0))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."conversation_participants" REPLICA IDENTITY FULL;


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_group_chat" boolean DEFAULT false NOT NULL,
    "name" "text",
    "owner_id" "uuid",
    "last_message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."conversations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."listing_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text",
    "listing_id" "uuid",
    "post_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_has_payload" CHECK ((("content" IS NOT NULL) OR ("listing_id" IS NOT NULL) OR ("post_id" IS NOT NULL)))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points_earned" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "point_transactions_nonzero" CHECK (("points_earned" <> 0))
);


ALTER TABLE "public"."point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "option_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "poll_options_option_text_not_blank" CHECK (("length"("btrim"("option_text")) > 0))
);


ALTER TABLE "public"."poll_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "poll_option_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."poll_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_comments_content_not_blank" CHECK (("length"("btrim"("content")) > 0))
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image_url" "text",
    "type" "public"."post_type" DEFAULT 'text'::"public"."post_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "points" integer DEFAULT 0 NOT NULL,
    "role" "public"."profile_role" DEFAULT 'user'::"public"."profile_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_points_nonnegative" CHECK (("points" >= 0))
);

ALTER TABLE ONLY "public"."profiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_profile_unique" UNIQUE ("conversation_id", "profile_id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_profile_listing_unique" UNIQUE ("profile_id", "listing_id");



ALTER TABLE ONLY "public"."listing_flags"
    ADD CONSTRAINT "listing_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_post_user_unique" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_user_unique" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



CREATE INDEX "comments_listing_created_at_idx" ON "public"."comments" USING "btree" ("listing_id", "created_at");



CREATE INDEX "comments_user_id_idx" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "conversation_participants_profile_conversation_idx" ON "public"."conversation_participants" USING "btree" ("profile_id", "conversation_id");



CREATE INDEX "conversation_participants_profile_id_idx" ON "public"."conversation_participants" USING "btree" ("profile_id");



CREATE INDEX "conversations_last_message_id_idx" ON "public"."conversations" USING "btree" ("last_message_id");



CREATE INDEX "conversations_owner_id_idx" ON "public"."conversations" USING "btree" ("owner_id");



CREATE INDEX "conversations_updated_at_desc_idx" ON "public"."conversations" USING "btree" ("updated_at" DESC);



CREATE INDEX "listing_favorites_listing_id_idx" ON "public"."listing_favorites" USING "btree" ("listing_id");



CREATE INDEX "listing_flags_flagged_by_idx" ON "public"."listing_flags" USING "btree" ("flagged_by");



CREATE INDEX "listing_flags_listing_flagged_at_desc_idx" ON "public"."listing_flags" USING "btree" ("listing_id", "flagged_at" DESC);



CREATE INDEX "listing_flags_resolved_flagged_at_desc_idx" ON "public"."listing_flags" USING "btree" ("resolved", "flagged_at" DESC);



CREATE INDEX "listings_category_idx" ON "public"."listings" USING "btree" ("category");



CREATE INDEX "listings_category_removed_created_at_idx" ON "public"."listings" USING "btree" ("category", "is_removed", "created_at" DESC);



CREATE INDEX "listings_created_at_desc_idx" ON "public"."listings" USING "btree" ("created_at" DESC);



CREATE INDEX "listings_metadata_gin_idx" ON "public"."listings" USING "gin" ("metadata");



CREATE INDEX "listings_removed_created_at_idx" ON "public"."listings" USING "btree" ("is_removed", "created_at" DESC);



CREATE INDEX "listings_submitted_by_idx" ON "public"."listings" USING "btree" ("submitted_by");



CREATE INDEX "listings_tags_gin_idx" ON "public"."listings" USING "gin" ("tags");



CREATE INDEX "messages_conversation_created_at_desc_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "messages_listing_id_idx" ON "public"."messages" USING "btree" ("listing_id");



CREATE INDEX "messages_post_id_idx" ON "public"."messages" USING "btree" ("post_id");



CREATE INDEX "messages_sender_id_idx" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "point_transactions_created_at_desc_idx" ON "public"."point_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "point_transactions_user_created_at_desc_idx" ON "public"."point_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "poll_options_post_id_idx" ON "public"."poll_options" USING "btree" ("post_id");



CREATE INDEX "poll_votes_poll_option_id_idx" ON "public"."poll_votes" USING "btree" ("poll_option_id");



CREATE INDEX "poll_votes_user_id_idx" ON "public"."poll_votes" USING "btree" ("user_id");



CREATE INDEX "post_comments_parent_id_idx" ON "public"."post_comments" USING "btree" ("parent_id");



CREATE INDEX "post_comments_post_created_at_idx" ON "public"."post_comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "post_comments_user_id_idx" ON "public"."post_comments" USING "btree" ("user_id");



CREATE INDEX "post_likes_user_id_idx" ON "public"."post_likes" USING "btree" ("user_id");



CREATE INDEX "posts_created_at_desc_idx" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "posts_type_idx" ON "public"."posts" USING "btree" ("type");



CREATE INDEX "posts_user_id_idx" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "profiles_points_desc_idx" ON "public"."profiles" USING "btree" ("points" DESC);



CREATE INDEX "profiles_role_idx" ON "public"."profiles" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "guard_conversation_updates_trigger" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."guard_conversation_updates"();



CREATE OR REPLACE TRIGGER "set_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_listings_updated_at" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_post_comments_updated_at" BEFORE UPDATE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "sync_conversation_last_message_trigger" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."sync_conversation_last_message"();



CREATE OR REPLACE TRIGGER "validate_poll_vote_option_trigger" BEFORE INSERT OR UPDATE ON "public"."poll_votes" FOR EACH ROW EXECUTE FUNCTION "public"."validate_poll_vote_option"();



CREATE OR REPLACE TRIGGER "validate_post_comment_parent_trigger" BEFORE INSERT OR UPDATE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_post_comment_parent"();



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_flags"
    ADD CONSTRAINT "listing_flags_flagged_by_fkey" FOREIGN KEY ("flagged_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listing_flags"
    ADD CONSTRAINT "listing_flags_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_flags"
    ADD CONSTRAINT "listing_flags_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_poll_option_id_fkey" FOREIGN KEY ("poll_option_id") REFERENCES "public"."poll_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_admin_delete_all" ON "public"."comments" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "comments_delete_own" ON "public"."comments" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "comments_insert_own" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "comments_select_all" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "comments_update_own" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participants_delete_self_or_group_owner" ON "public"."conversation_participants" FOR DELETE TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "conversation_participants"."conversation_id") AND ("conversations"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "conversation_participants_insert_group_owner_or_creator" ON "public"."conversation_participants" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "conversation_participants"."conversation_id") AND ("conversations"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "conversation_participants_select_participant" ON "public"."conversation_participants" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "conversation_participants_update_own_read_state" ON "public"."conversation_participants" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_delete_admin_only" ON "public"."conversations" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "conversations_insert_authenticated" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("owner_id" IS NULL) OR ("owner_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "conversations_select_participant" ON "public"."conversations" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("id", "auth"."uid"()));



CREATE POLICY "conversations_update_group_owner" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "conversations_update_participant" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ("public"."is_conversation_participant"("id", "auth"."uid"())) WITH CHECK ("public"."is_conversation_participant"("id", "auth"."uid"()));



ALTER TABLE "public"."listing_favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listing_favorites_delete_own" ON "public"."listing_favorites" FOR DELETE TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "listing_favorites_insert_own" ON "public"."listing_favorites" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "listing_favorites_select_own" ON "public"."listing_favorites" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."listing_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listing_flags_insert_admin_only_or_rpc" ON "public"."listing_flags" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "listing_flags_select_admin_only" ON "public"."listing_flags" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "listing_flags_update_admin_only_or_rpc" ON "public"."listing_flags" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listings_delete_admin" ON "public"."listings" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "listings_delete_owner" ON "public"."listings" FOR DELETE TO "authenticated" USING (("submitted_by" = "auth"."uid"()));



CREATE POLICY "listings_insert_own" ON "public"."listings" FOR INSERT TO "authenticated" WITH CHECK (("submitted_by" = "auth"."uid"()));



CREATE POLICY "listings_select_admin_all" ON "public"."listings" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "listings_select_visible" ON "public"."listings" FOR SELECT USING (("is_removed" = false));



CREATE POLICY "listings_update_admin" ON "public"."listings" FOR UPDATE TO "authenticated" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "listings_update_owner" ON "public"."listings" FOR UPDATE TO "authenticated" USING (("submitted_by" = "auth"."uid"())) WITH CHECK (("submitted_by" = "auth"."uid"()));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete_admin_only" ON "public"."messages" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "messages_insert_participant_sender" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_conversation_participant"("conversation_id", "auth"."uid"())));



CREATE POLICY "messages_select_participant" ON "public"."messages" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id", "auth"."uid"()));



CREATE POLICY "messages_update_sender" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("sender_id" = "auth"."uid"())) WITH CHECK (("sender_id" = "auth"."uid"()));



ALTER TABLE "public"."point_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "point_transactions_admin_read_all" ON "public"."point_transactions" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "point_transactions_insert_own_or_rpc" ON "public"."point_transactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "point_transactions_select_own" ON "public"."point_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."poll_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "poll_options_delete_post_owner" ON "public"."poll_options" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "poll_options"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "poll_options_insert_post_owner" ON "public"."poll_options" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "poll_options"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



CREATE POLICY "poll_options_select_all" ON "public"."poll_options" FOR SELECT USING (true);



CREATE POLICY "poll_options_update_post_owner" ON "public"."poll_options" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "poll_options"."post_id") AND ("posts"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "poll_options"."post_id") AND ("posts"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."poll_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "poll_votes_delete_own" ON "public"."poll_votes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "poll_votes_insert_own" ON "public"."poll_votes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "poll_votes_select_all" ON "public"."poll_votes" FOR SELECT USING (true);



ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_comments_admin_delete_all" ON "public"."post_comments" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "post_comments_delete_own" ON "public"."post_comments" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "post_comments_insert_own" ON "public"."post_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "post_comments_select_all" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "post_comments_update_own" ON "public"."post_comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_likes_delete_own" ON "public"."post_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "post_likes_insert_own" ON "public"."post_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "post_likes_select_all" ON "public"."post_likes" FOR SELECT USING (true);



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_admin_delete_all" ON "public"."posts" FOR DELETE TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "posts_delete_own" ON "public"."posts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "posts_insert_own" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "posts_select_all" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "posts_update_own" ON "public"."posts" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_read_all" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "profiles_insert_own_profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_public_profile" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_own_profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversation_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON TABLE "public"."listing_flags" TO "anon";
GRANT ALL ON TABLE "public"."listing_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_flags" TO "service_role";



GRANT ALL ON FUNCTION "public"."flag_listing"("p_listing_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."flag_listing"("p_listing_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."flag_listing"("p_listing_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_conversation_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_conversation_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_conversation_updates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_user_points"("user_id_param" "uuid", "points_to_add" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_user_points"("user_id_param" "uuid", "points_to_add" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_user_points"("user_id_param" "uuid", "points_to_add" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_conversation_participant"("check_conversation_id" "uuid", "check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("check_conversation_id" "uuid", "check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("check_conversation_id" "uuid", "check_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_listing"("p_listing_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_listing"("p_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_listing"("p_listing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_flags_for_listing"("p_listing_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_flags_for_listing"("p_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_flags_for_listing"("p_listing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_listing"("p_listing_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_listing"("p_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_listing"("p_listing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_poll_vote_option"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_poll_vote_option"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_poll_vote_option"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_post_comment_parent"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_post_comment_parent"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_post_comment_parent"() TO "service_role";


















GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."listing_favorites" TO "anon";
GRANT ALL ON TABLE "public"."listing_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."point_transactions" TO "anon";
GRANT ALL ON TABLE "public"."point_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."point_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."poll_options" TO "anon";
GRANT ALL ON TABLE "public"."poll_options" TO "authenticated";
GRANT ALL ON TABLE "public"."poll_options" TO "service_role";



GRANT ALL ON TABLE "public"."poll_votes" TO "anon";
GRANT ALL ON TABLE "public"."poll_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."poll_votes" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































