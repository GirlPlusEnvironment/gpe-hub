do $$
begin
  if not exists (select 1 from pg_type where typname = 'hub_mentorship_listing_type') then
    create type public.hub_mentorship_listing_type as enum ('mentor_offer', 'mentor_request');
  end if;

  if not exists (select 1 from pg_type where typname = 'hub_mentorship_listing_status') then
    create type public.hub_mentorship_listing_status as enum (
      'draft',
      'pending_review',
      'published',
      'matched',
      'paused',
      'closed',
      'expired',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'hub_mentorship_match_status') then
    create type public.hub_mentorship_match_status as enum (
      'requested',
      'accepted',
      'declined',
      'cancelled',
      'active',
      'completed',
      'ended'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'hub_cabin_member_status') then
    create type public.hub_cabin_member_status as enum (
      'invited',
      'requested',
      'approved',
      'active',
      'declined',
      'removed',
      'left'
    );
  end if;
end
$$;

alter table public.gpe_cabins
  add column if not exists theme text,
  add column if not exists visibility text not null default 'members',
  add column if not exists max_members integer,
  add column if not exists location_mode text not null default 'either',
  add column if not exists focus_area text,
  add column if not exists invite_only boolean not null default false,
  add column if not exists approval_required boolean not null default true,
  add column if not exists lead_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists community_agreement text,
  add column if not exists status text not null default 'active',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.gpe_cabins
  drop constraint if exists gpe_cabins_metadata_object,
  add constraint gpe_cabins_metadata_object check (jsonb_typeof(metadata) = 'object');

alter table public.gpe_cabins
  drop constraint if exists gpe_cabins_max_members_check,
  add constraint gpe_cabins_max_members_check check (max_members is null or max_members > 0);

create index if not exists gpe_cabins_conversation_idx
on public.gpe_cabins (conversation_id)
where conversation_id is not null;

create index if not exists gpe_cabins_lead_idx
on public.gpe_cabins (lead_profile_id)
where lead_profile_id is not null;

create table if not exists public.hub_linked_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null,
  source_entity_id uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  title text not null,
  created_by uuid references public.profiles(id) on delete set null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hub_linked_conversations_type_check check (conversation_type in ('mentorship', 'cabin', 'direct', 'group', 'admin')),
  constraint hub_linked_conversations_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint hub_linked_conversations_source_unique unique (conversation_type, source_entity_id)
);

create unique index if not exists hub_linked_conversations_idempotency_unique
on public.hub_linked_conversations (idempotency_key)
where idempotency_key is not null;

create index if not exists hub_linked_conversations_conversation_idx
on public.hub_linked_conversations (conversation_id);

create table if not exists public.hub_mentorship_listings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_type public.hub_mentorship_listing_type not null,
  status public.hub_mentorship_listing_status not null default 'pending_review',
  display_name text not null,
  headline text not null,
  email text,
  location text,
  time_zone text,
  communication_format text,
  availability text,
  intro text,
  topics text[] not null default '{}'::text[],
  climate_focus text[] not null default '{}'::text[],
  career_stage text,
  organization_role text,
  meeting_frequency text,
  remote_preference text not null default 'either',
  profile_image_url text,
  contact_consent boolean not null default false,
  visibility text not null default 'members',
  expires_at date,
  support_needed text,
  current_goals text,
  skills_to_develop text,
  preferred_mentor_experience text,
  ideal_outcome text,
  urgency text,
  mentor_areas text,
  experience_summary text,
  best_positioned_to_support text,
  mentee_capacity integer,
  mentorship_format text,
  boundaries text,
  professional_links text,
  published_at timestamptz,
  closed_at timestamptz,
  moderation_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hub_mentorship_listings_contact_consent_check check (status in ('draft', 'pending_review') or contact_consent),
  constraint hub_mentorship_listings_capacity_check check (mentee_capacity is null or mentee_capacity >= 0),
  constraint hub_mentorship_listings_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists hub_mentorship_listings_published_idx
on public.hub_mentorship_listings (status, listing_type, created_at desc);

create index if not exists hub_mentorship_listings_profile_idx
on public.hub_mentorship_listings (profile_id, created_at desc);

create index if not exists hub_mentorship_listings_topics_gin_idx
on public.hub_mentorship_listings using gin (topics);

create index if not exists hub_mentorship_listings_focus_gin_idx
on public.hub_mentorship_listings using gin (climate_focus);

create table if not exists public.hub_mentorship_match_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hub_mentorship_listings(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  mentee_profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.hub_mentorship_match_status not null default 'requested',
  message text,
  fit_reason text,
  proposed_availability text,
  first_meeting_idea text,
  response_note text,
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hub_mentorship_match_requests_no_self_check check (mentor_profile_id <> mentee_profile_id)
);

create unique index if not exists hub_mentorship_match_requests_open_unique
on public.hub_mentorship_match_requests (listing_id, mentor_profile_id, mentee_profile_id)
where status = 'requested';

create index if not exists hub_mentorship_match_requests_requester_idx
on public.hub_mentorship_match_requests (requester_profile_id, created_at desc);

create index if not exists hub_mentorship_match_requests_recipient_idx
on public.hub_mentorship_match_requests (recipient_profile_id, created_at desc);

create table if not exists public.hub_mentorship_matches (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.hub_mentorship_listings(id) on delete cascade,
  match_request_id uuid not null references public.hub_mentorship_match_requests(id) on delete cascade,
  mentor_profile_id uuid not null references public.profiles(id) on delete cascade,
  mentee_profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.hub_mentorship_match_status not null default 'active',
  conversation_id uuid references public.conversations(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  completed_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hub_mentorship_matches_request_unique unique (match_request_id),
  constraint hub_mentorship_matches_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint hub_mentorship_matches_no_self_check check (mentor_profile_id <> mentee_profile_id)
);

create index if not exists hub_mentorship_matches_participants_idx
on public.hub_mentorship_matches (mentor_profile_id, mentee_profile_id, status);

create table if not exists public.hub_cabin_members (
  id uuid primary key default gen_random_uuid(),
  cabin_id uuid not null references public.gpe_cabins(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  season_member_id uuid references public.gpe_season_members(id) on delete set null,
  role text not null default 'member',
  status public.hub_cabin_member_status not null default 'requested',
  introduction text,
  join_reason text,
  rules_consent boolean not null default false,
  invited_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hub_cabin_members_unique_profile unique (cabin_id, profile_id),
  constraint hub_cabin_members_role_check check (role in ('lead', 'co_lead', 'member'))
);

create index if not exists hub_cabin_members_profile_idx
on public.hub_cabin_members (profile_id, status);

create index if not exists hub_cabin_members_cabin_status_idx
on public.hub_cabin_members (cabin_id, status);

create table if not exists public.hub_match_activity (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hub_match_activity_entity_check check (entity_type in ('mentorship_listing', 'mentorship_match_request', 'mentorship_match', 'cabin', 'cabin_member', 'linked_conversation')),
  constraint hub_match_activity_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists hub_match_activity_entity_idx
on public.hub_match_activity (entity_type, entity_id, created_at desc);

drop trigger if exists set_hub_linked_conversations_updated_at on public.hub_linked_conversations;
create trigger set_hub_linked_conversations_updated_at
before update on public.hub_linked_conversations
for each row execute function public.update_updated_at_column();

drop trigger if exists set_hub_mentorship_listings_updated_at on public.hub_mentorship_listings;
create trigger set_hub_mentorship_listings_updated_at
before update on public.hub_mentorship_listings
for each row execute function public.update_updated_at_column();

drop trigger if exists set_hub_mentorship_match_requests_updated_at on public.hub_mentorship_match_requests;
create trigger set_hub_mentorship_match_requests_updated_at
before update on public.hub_mentorship_match_requests
for each row execute function public.update_updated_at_column();

drop trigger if exists set_hub_mentorship_matches_updated_at on public.hub_mentorship_matches;
create trigger set_hub_mentorship_matches_updated_at
before update on public.hub_mentorship_matches
for each row execute function public.update_updated_at_column();

drop trigger if exists set_hub_cabin_members_updated_at on public.hub_cabin_members;
create trigger set_hub_cabin_members_updated_at
before update on public.hub_cabin_members
for each row execute function public.update_updated_at_column();

alter table public.hub_linked_conversations enable row level security;
alter table public.hub_mentorship_listings enable row level security;
alter table public.hub_mentorship_match_requests enable row level security;
alter table public.hub_mentorship_matches enable row level security;
alter table public.hub_cabin_members enable row level security;
alter table public.hub_match_activity enable row level security;

drop policy if exists hub_mentorship_listings_read_member_visible on public.hub_mentorship_listings;
create policy hub_mentorship_listings_read_member_visible
on public.hub_mentorship_listings
for select
to authenticated
using (
  public.can_manage_camp(auth.uid())
  or profile_id = auth.uid()
  or (status = 'published' and visibility in ('members', 'public') and public.profile_has_active_membership(auth.uid()))
);

drop policy if exists hub_mentorship_listings_insert_owner on public.hub_mentorship_listings;
create policy hub_mentorship_listings_insert_owner
on public.hub_mentorship_listings
for insert
to authenticated
with check (profile_id = auth.uid() and public.profile_has_active_membership(auth.uid()));

drop policy if exists hub_mentorship_listings_update_owner_or_team on public.hub_mentorship_listings;
create policy hub_mentorship_listings_update_owner_or_team
on public.hub_mentorship_listings
for update
to authenticated
using (profile_id = auth.uid() or public.can_manage_camp(auth.uid()))
with check (profile_id = auth.uid() or public.can_manage_camp(auth.uid()));

drop policy if exists hub_mentorship_match_requests_read_participants on public.hub_mentorship_match_requests;
create policy hub_mentorship_match_requests_read_participants
on public.hub_mentorship_match_requests
for select
to authenticated
using (
  requester_profile_id = auth.uid()
  or recipient_profile_id = auth.uid()
  or public.can_manage_camp(auth.uid())
);

drop policy if exists hub_mentorship_matches_read_participants on public.hub_mentorship_matches;
create policy hub_mentorship_matches_read_participants
on public.hub_mentorship_matches
for select
to authenticated
using (
  mentor_profile_id = auth.uid()
  or mentee_profile_id = auth.uid()
  or public.can_manage_camp(auth.uid())
);

drop policy if exists hub_linked_conversations_read_participants on public.hub_linked_conversations;
create policy hub_linked_conversations_read_participants
on public.hub_linked_conversations
for select
to authenticated
using (
  public.is_conversation_participant(conversation_id, auth.uid())
  or public.can_manage_camp(auth.uid())
);

drop policy if exists hub_cabin_members_read_related on public.hub_cabin_members;
create policy hub_cabin_members_read_related
on public.hub_cabin_members
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.can_manage_camp(auth.uid())
  or exists (
    select 1
    from public.hub_cabin_members own
    where own.cabin_id = hub_cabin_members.cabin_id
      and own.profile_id = auth.uid()
      and own.status in ('approved', 'active')
  )
);

drop policy if exists hub_match_activity_read_related on public.hub_match_activity;
create policy hub_match_activity_read_related
on public.hub_match_activity
for select
to authenticated
using (
  actor_profile_id = auth.uid()
  or public.can_manage_camp(auth.uid())
);

grant select, insert, update on public.hub_mentorship_listings to authenticated;
grant select on public.hub_mentorship_match_requests, public.hub_mentorship_matches, public.hub_linked_conversations, public.hub_cabin_members, public.hub_match_activity to authenticated;

insert into public.hub_point_rules (
  action_type,
  display_name,
  point_value,
  active,
  counts_for_ongoing,
  counts_for_season,
  counts_for_cabin,
  requires_approval,
  duplicate_strategy,
  metadata
)
values
  ('mentorship_listing_submitted', 'Submit a mentorship listing', 0, false, true, false, false, true, 'source_once', '{"source":"mentorship"}'::jsonb),
  ('mentorship_listing_approved', 'Approved mentorship listing', 0, true, true, false, false, false, 'source_once', '{"source":"mentorship"}'::jsonb),
  ('mentorship_match_accepted', 'Mentorship match accepted', 0, true, true, false, false, false, 'source_once', '{"source":"mentorship"}'::jsonb),
  ('mentorship_session_completed', 'Mentorship session completed', 0, true, true, false, false, true, 'source_once', '{"source":"mentorship"}'::jsonb),
  ('mentorship_completed', 'Mentorship completed', 0, true, true, false, false, true, 'source_once', '{"source":"mentorship"}'::jsonb),
  ('cabin_created', 'Create a Camp cabin', 0, true, true, true, true, false, 'source_once', '{"source":"cabin"}'::jsonb),
  ('cabin_joined', 'Join a Camp cabin', 0, true, true, true, true, false, 'source_once', '{"source":"cabin"}'::jsonb)
on conflict (action_type) do update set
  display_name = excluded.display_name,
  active = public.hub_point_rules.active,
  counts_for_ongoing = excluded.counts_for_ongoing,
  counts_for_season = excluded.counts_for_season,
  counts_for_cabin = excluded.counts_for_cabin,
  requires_approval = excluded.requires_approval,
  duplicate_strategy = excluded.duplicate_strategy,
  metadata = public.hub_point_rules.metadata || excluded.metadata,
  updated_at = now();

create or replace function public.create_linked_conversation(
  p_conversation_type text,
  p_source_entity_id uuid,
  p_participant_profile_ids uuid[],
  p_title text,
  p_initial_system_message text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  existing public.hub_linked_conversations%rowtype;
  conversation_row public.conversations%rowtype;
  profile_id uuid;
  participant_ids uuid[];
  message_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  if p_conversation_type not in ('mentorship', 'cabin', 'direct', 'group', 'admin') then
    raise exception 'Unsupported linked conversation type: %', p_conversation_type;
  end if;

  if p_source_entity_id is null then
    raise exception 'Source entity ID is required.';
  end if;

  participant_ids := (
    select coalesce(array_agg(distinct id order by id), array[]::uuid[])
    from unnest(coalesce(p_participant_profile_ids, array[]::uuid[])) id
    where id is not null
  );

  if array_length(participant_ids, 1) is null then
    raise exception 'At least one participant is required.';
  end if;

  if not public.can_manage_camp(actor) and actor <> all(participant_ids) then
    raise exception 'The current member must be part of the linked conversation.';
  end if;

  foreach profile_id in array participant_ids loop
    if not exists (select 1 from public.profiles p where p.id = profile_id) then
      raise exception 'Conversation participant % does not exist.', profile_id;
    end if;

    if not public.can_manage_camp(actor) and not public.profile_has_active_membership(profile_id) then
      raise exception 'Conversation participant % does not have active membership access.', profile_id;
    end if;
  end loop;

  select *
  into existing
  from public.hub_linked_conversations
  where conversation_type = p_conversation_type
    and source_entity_id = p_source_entity_id;

  if found then
    insert into public.conversation_participants (conversation_id, profile_id)
    select existing.conversation_id, id
    from unnest(participant_ids) id
    on conflict on constraint conversation_participants_conversation_profile_unique do nothing;

    return jsonb_build_object(
      'ok', true,
      'created', false,
      'conversationId', existing.conversation_id,
      'linkedConversationId', existing.id
    );
  end if;

  insert into public.conversations (is_group_chat, name, owner_id)
  values (
    array_length(participant_ids, 1) > 2 or p_conversation_type in ('mentorship', 'cabin', 'group', 'admin'),
    nullif(trim(p_title), ''),
    actor
  )
  returning * into conversation_row;

  insert into public.conversation_participants (conversation_id, profile_id)
  select conversation_row.id, id
  from unnest(participant_ids) id
  on conflict on constraint conversation_participants_conversation_profile_unique do nothing;

  insert into public.hub_linked_conversations (
    conversation_type,
    source_entity_id,
    conversation_id,
    title,
    created_by,
    idempotency_key,
    metadata
  )
  values (
    p_conversation_type,
    p_source_entity_id,
    conversation_row.id,
    coalesce(nullif(trim(p_title), ''), initcap(p_conversation_type) || ' chat'),
    actor,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into existing;

  if nullif(trim(coalesce(p_initial_system_message, '')), '') is not null then
    insert into public.messages (conversation_id, sender_id, content)
    values (conversation_row.id, actor, trim(p_initial_system_message))
    returning id into message_id;

    update public.conversations
    set last_message_id = message_id,
        updated_at = now()
    where id = conversation_row.id;
  end if;

  insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
  values (
    actor,
    'linked_conversation',
    existing.id,
    'created',
    jsonb_build_object(
      'conversationType', p_conversation_type,
      'conversationId', conversation_row.id,
      'sourceEntityId', p_source_entity_id,
      'participantProfileIds', participant_ids
    )
  );

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'conversationId', conversation_row.id,
    'linkedConversationId', existing.id,
    'messageId', message_id
  );
end;
$$;

revoke all on function public.create_linked_conversation(text, uuid, uuid[], text, text, jsonb, text) from public;
grant execute on function public.create_linked_conversation(text, uuid, uuid[], text, text, jsonb, text) to authenticated;

create or replace function public.submit_mentorship_listing(p_payload jsonb)
returns public.hub_mentorship_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_profile public.profiles%rowtype;
  listing_row public.hub_mentorship_listings%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  if not public.profile_has_active_membership(actor) then
    raise exception 'Active GPE membership is required to submit a mentorship listing.';
  end if;

  select * into actor_profile from public.profiles where id = actor;

  insert into public.hub_mentorship_listings (
    profile_id,
    listing_type,
    status,
    display_name,
    headline,
    email,
    location,
    time_zone,
    communication_format,
    availability,
    intro,
    topics,
    climate_focus,
    career_stage,
    organization_role,
    meeting_frequency,
    remote_preference,
    profile_image_url,
    contact_consent,
    visibility,
    expires_at,
    support_needed,
    current_goals,
    skills_to_develop,
    preferred_mentor_experience,
    ideal_outcome,
    urgency,
    mentor_areas,
    experience_summary,
    best_positioned_to_support,
    mentee_capacity,
    mentorship_format,
    boundaries,
    professional_links,
    metadata
  )
  values (
    actor,
    coalesce((p_payload->>'listingType')::public.hub_mentorship_listing_type, 'mentor_request'::public.hub_mentorship_listing_type),
    coalesce((p_payload->>'status')::public.hub_mentorship_listing_status, 'pending_review'::public.hub_mentorship_listing_status),
    coalesce(nullif(trim(p_payload->>'displayName'), ''), actor_profile.full_name, actor_profile.username, 'GPE member'),
    coalesce(nullif(trim(p_payload->>'headline'), ''), case when p_payload->>'listingType' = 'mentor_offer' then 'Mentor offer' else 'Mentorship request' end),
    lower(nullif(trim(coalesce(actor_profile.email, p_payload->>'email')), '')),
    nullif(trim(p_payload->>'location'), ''),
    nullif(trim(p_payload->>'timeZone'), ''),
    nullif(trim(p_payload->>'communicationFormat'), ''),
    nullif(trim(p_payload->>'availability'), ''),
    nullif(trim(p_payload->>'intro'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'topics', '[]'::jsonb))), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'climateFocus', '[]'::jsonb))), '{}'::text[]),
    nullif(trim(p_payload->>'careerStage'), ''),
    nullif(trim(p_payload->>'organizationRole'), ''),
    nullif(trim(p_payload->>'meetingFrequency'), ''),
    coalesce(nullif(trim(p_payload->>'remotePreference'), ''), 'either'),
    nullif(trim(p_payload->>'profileImageUrl'), ''),
    coalesce((p_payload->>'contactConsent')::boolean, false),
    coalesce(nullif(trim(p_payload->>'visibility'), ''), 'members'),
    nullif(p_payload->>'expiresAt', '')::date,
    nullif(trim(p_payload->>'supportNeeded'), ''),
    nullif(trim(p_payload->>'currentGoals'), ''),
    nullif(trim(p_payload->>'skillsToDevelop'), ''),
    nullif(trim(p_payload->>'preferredMentorExperience'), ''),
    nullif(trim(p_payload->>'idealOutcome'), ''),
    nullif(trim(p_payload->>'urgency'), ''),
    nullif(trim(p_payload->>'mentorAreas'), ''),
    nullif(trim(p_payload->>'experienceSummary'), ''),
    nullif(trim(p_payload->>'bestPositionedToSupport'), ''),
    nullif(p_payload->>'menteeCapacity', '')::integer,
    nullif(trim(p_payload->>'mentorshipFormat'), ''),
    nullif(trim(p_payload->>'boundaries'), ''),
    nullif(trim(p_payload->>'professionalLinks'), ''),
    coalesce(p_payload->'metadata', '{}'::jsonb)
  )
  returning * into listing_row;

  insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
  values (actor, 'mentorship_listing', listing_row.id, 'submitted', jsonb_build_object('status', listing_row.status));

  return listing_row;
end;
$$;

revoke all on function public.submit_mentorship_listing(jsonb) from public;
grant execute on function public.submit_mentorship_listing(jsonb) to authenticated;

create or replace function public.request_mentorship_match(
  p_listing_id uuid,
  p_message text default null,
  p_fit_reason text default null,
  p_proposed_availability text default null,
  p_first_meeting_idea text default null
)
returns public.hub_mentorship_match_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  listing_row public.hub_mentorship_listings%rowtype;
  request_row public.hub_mentorship_match_requests%rowtype;
  mentor_id uuid;
  mentee_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  if not public.profile_has_active_membership(actor) then
    raise exception 'Active GPE membership is required to request a mentorship match.';
  end if;

  select * into listing_row
  from public.hub_mentorship_listings
  where id = p_listing_id
    and status = 'published';

  if not found then
    raise exception 'Published mentorship listing not found.';
  end if;

  if listing_row.profile_id = actor then
    raise exception 'You cannot request a match with your own listing.';
  end if;

  if listing_row.listing_type = 'mentor_offer' then
    mentor_id := listing_row.profile_id;
    mentee_id := actor;
  else
    mentor_id := actor;
    mentee_id := listing_row.profile_id;
  end if;

  insert into public.hub_mentorship_match_requests (
    listing_id,
    requester_profile_id,
    recipient_profile_id,
    mentor_profile_id,
    mentee_profile_id,
    message,
    fit_reason,
    proposed_availability,
    first_meeting_idea
  )
  values (
    listing_row.id,
    actor,
    listing_row.profile_id,
    mentor_id,
    mentee_id,
    nullif(trim(coalesce(p_message, '')), ''),
    nullif(trim(coalesce(p_fit_reason, '')), ''),
    nullif(trim(coalesce(p_proposed_availability, '')), ''),
    nullif(trim(coalesce(p_first_meeting_idea, '')), '')
  )
  on conflict (listing_id, mentor_profile_id, mentee_profile_id) where status = 'requested'
  do update set updated_at = now()
  returning * into request_row;

  insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
  values (actor, 'mentorship_match_request', request_row.id, 'requested', jsonb_build_object('listingId', listing_row.id));

  insert into public.gpe_notification_outbox (event_type, user_id, payload, status)
  values (
    'mentorship_request_received',
    listing_row.profile_id,
    jsonb_build_object('listingId', listing_row.id, 'requestId', request_row.id, 'requesterProfileId', actor),
    'pending'
  );

  return request_row;
end;
$$;

revoke all on function public.request_mentorship_match(uuid, text, text, text, text) from public;
grant execute on function public.request_mentorship_match(uuid, text, text, text, text) to authenticated;

create or replace function public.respond_mentorship_match_request(
  p_request_id uuid,
  p_decision text,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  request_row public.hub_mentorship_match_requests%rowtype;
  listing_row public.hub_mentorship_listings%rowtype;
  match_row public.hub_mentorship_matches%rowtype;
  linked_result jsonb;
  event_result jsonb;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  select * into request_row
  from public.hub_mentorship_match_requests
  where id = p_request_id;

  if not found then
    raise exception 'Mentorship match request not found.';
  end if;

  if actor <> request_row.recipient_profile_id and not public.can_manage_camp(actor) then
    raise exception 'Only the recipient or a team admin can respond to this match request.';
  end if;

  if request_row.status <> 'requested' then
    select * into match_row
    from public.hub_mentorship_matches
    where match_request_id = request_row.id;

    return jsonb_build_object(
      'ok', true,
      'alreadyProcessed', true,
      'status', request_row.status,
      'matchId', match_row.id,
      'conversationId', match_row.conversation_id
    );
  end if;

  select * into listing_row
  from public.hub_mentorship_listings
  where id = request_row.listing_id;

  if lower(coalesce(p_decision, '')) not in ('accepted', 'declined', 'cancelled') then
    raise exception 'Decision must be accepted, declined, or cancelled.';
  end if;

  if lower(p_decision) <> 'accepted' then
    update public.hub_mentorship_match_requests
    set status = lower(p_decision)::public.hub_mentorship_match_status,
        response_note = nullif(trim(coalesce(p_response_note, '')), ''),
        responded_by = actor,
        responded_at = now()
    where id = request_row.id
    returning * into request_row;

    insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
    values (actor, 'mentorship_match_request', request_row.id, lower(p_decision), '{}'::jsonb);

    return jsonb_build_object('ok', true, 'status', request_row.status, 'requestId', request_row.id);
  end if;

  update public.hub_mentorship_match_requests
  set status = 'accepted',
      response_note = nullif(trim(coalesce(p_response_note, '')), ''),
      responded_by = actor,
      responded_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.hub_mentorship_matches (
    listing_id,
    match_request_id,
    mentor_profile_id,
    mentee_profile_id,
    status,
    accepted_by,
    accepted_at,
    metadata
  )
  values (
    request_row.listing_id,
    request_row.id,
    request_row.mentor_profile_id,
    request_row.mentee_profile_id,
    'active',
    actor,
    now(),
    jsonb_build_object('acceptedFromRequest', request_row.id)
  )
  on conflict (match_request_id) do update
  set status = 'active',
      accepted_by = coalesce(public.hub_mentorship_matches.accepted_by, excluded.accepted_by),
      accepted_at = coalesce(public.hub_mentorship_matches.accepted_at, excluded.accepted_at),
      updated_at = now()
  returning * into match_row;

  linked_result := public.create_linked_conversation(
    'mentorship',
    match_row.id,
    array[request_row.mentor_profile_id, request_row.mentee_profile_id],
    'Mentorship chat',
    'Your mentorship match is confirmed. Use this space to introduce yourselves, set goals, and plan your first conversation.',
    jsonb_build_object('listingId', request_row.listing_id, 'matchRequestId', request_row.id),
    'mentorship:' || match_row.id::text
  );

  update public.hub_mentorship_matches
  set conversation_id = (linked_result->>'conversationId')::uuid
  where id = match_row.id
  returning * into match_row;

  update public.hub_mentorship_listings
  set status = case
      when listing_type = 'mentor_offer' and coalesce(mentee_capacity, 1) > 1 then status
      else 'matched'
    end,
    mentee_capacity = case
      when listing_type = 'mentor_offer' and mentee_capacity is not null and mentee_capacity > 0 then mentee_capacity - 1
      else mentee_capacity
    end
  where id = listing_row.id;

  event_result := public.service_record_point_event(
    'MENTORSHIP_MATCH_ACCEPTED',
    null,
    request_row.mentor_profile_id,
    null,
    null,
    'mentorship_match',
    match_row.id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object('menteeProfileId', request_row.mentee_profile_id, 'listingId', request_row.listing_id),
    now()
  );

  perform public.service_record_point_event(
    'MENTORSHIP_MATCH_ACCEPTED',
    null,
    request_row.mentee_profile_id,
    null,
    null,
    'mentorship_match',
    match_row.id,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object('mentorProfileId', request_row.mentor_profile_id, 'listingId', request_row.listing_id),
    now()
  );

  insert into public.gpe_notification_outbox (event_type, user_id, payload, status)
  values
    ('mentorship_request_accepted', request_row.requester_profile_id, jsonb_build_object('requestId', request_row.id, 'matchId', match_row.id, 'conversationId', match_row.conversation_id), 'pending'),
    ('new_group_chat_created', request_row.mentor_profile_id, jsonb_build_object('source', 'mentorship', 'matchId', match_row.id, 'conversationId', match_row.conversation_id), 'pending'),
    ('new_group_chat_created', request_row.mentee_profile_id, jsonb_build_object('source', 'mentorship', 'matchId', match_row.id, 'conversationId', match_row.conversation_id), 'pending');

  insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
  values (actor, 'mentorship_match', match_row.id, 'accepted', jsonb_build_object('conversationId', match_row.conversation_id, 'pointEvent', event_result));

  return jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'requestId', request_row.id,
    'matchId', match_row.id,
    'conversationId', match_row.conversation_id,
    'linkedConversation', linked_result
  );
end;
$$;

revoke all on function public.respond_mentorship_match_request(uuid, text, text) from public;
grant execute on function public.respond_mentorship_match_request(uuid, text, text) to authenticated;

create or replace function public.create_hub_cabin(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  profile_row public.profiles%rowtype;
  season_row public.gpe_seasons%rowtype;
  cabin_row public.gpe_cabins%rowtype;
  season_member_row public.gpe_season_members%rowtype;
  linked_result jsonb;
  event_result jsonb;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  if not public.profile_has_active_membership(actor) then
    raise exception 'Active GPE membership is required to create a cabin.';
  end if;

  select * into profile_row from public.profiles where id = actor;

  if nullif(trim(coalesce(profile_row.email, '')), '') is null then
    raise exception 'A profile email is required to enroll in a cabin.';
  end if;

  if nullif(p_payload->>'seasonId', '') is not null then
    select * into season_row
    from public.gpe_seasons
    where id = (p_payload->>'seasonId')::uuid;
  else
    select * into season_row
    from public.gpe_seasons
    where status = 'active'
    order by starts_at desc nulls last, created_at desc
    limit 1;
  end if;

  if not found then
    raise exception 'Active Camp season not found.';
  end if;

  insert into public.gpe_cabins (
    season_id,
    name,
    description,
    image_url,
    theme,
    visibility,
    max_members,
    location_mode,
    focus_area,
    invite_only,
    approval_required,
    lead_profile_id,
    community_agreement,
    status,
    metadata
  )
  values (
    season_row.id,
    trim(p_payload->>'name'),
    nullif(trim(p_payload->>'description'), ''),
    nullif(trim(coalesce(p_payload->>'imageUrl', p_payload->>'iconImageUrl')), ''),
    nullif(trim(p_payload->>'theme'), ''),
    coalesce(nullif(trim(p_payload->>'visibility'), ''), 'members'),
    nullif(p_payload->>'maxMembers', '')::integer,
    coalesce(nullif(trim(p_payload->>'locationMode'), ''), 'either'),
    nullif(trim(p_payload->>'focusArea'), ''),
    coalesce((p_payload->>'inviteOnly')::boolean, false),
    coalesce((p_payload->>'approvalRequired')::boolean, true),
    actor,
    nullif(trim(p_payload->>'communityAgreement'), ''),
    'active',
    coalesce(p_payload->'metadata', '{}'::jsonb)
  )
  returning * into cabin_row;

  insert into public.gpe_season_members (
    season_id,
    user_id,
    neon_account_id,
    contact_email,
    cabin_id,
    status
  )
  values (
    season_row.id,
    actor,
    profile_row.neon_account_id,
    lower(profile_row.email),
    cabin_row.id,
    'active'
  )
  on conflict (season_id, user_id) do update
  set cabin_id = excluded.cabin_id,
      neon_account_id = coalesce(public.gpe_season_members.neon_account_id, excluded.neon_account_id),
      contact_email = excluded.contact_email,
      status = case when public.gpe_season_members.status = 'withdrawn' then public.gpe_season_members.status else 'active'::public.gpe_season_member_status end,
      updated_at = now()
  returning * into season_member_row;

  insert into public.hub_cabin_members (
    cabin_id,
    profile_id,
    season_member_id,
    role,
    status,
    rules_consent
  )
  values (
    cabin_row.id,
    actor,
    season_member_row.id,
    'lead',
    'active',
    true
  )
  on conflict (cabin_id, profile_id) do update
  set season_member_id = excluded.season_member_id,
      role = 'lead',
      status = 'active',
      rules_consent = true,
      updated_at = now();

  linked_result := public.create_linked_conversation(
    'cabin',
    cabin_row.id,
    array[actor],
    cabin_row.name || ' cabin',
    'Welcome to the cabin chat! Use this space to coordinate challenges, celebrate points, and stay connected throughout Camp GPE.',
    jsonb_build_object('seasonId', season_row.id, 'seasonMemberId', season_member_row.id),
    'cabin:' || cabin_row.id::text
  );

  update public.gpe_cabins
  set conversation_id = (linked_result->>'conversationId')::uuid
  where id = cabin_row.id
  returning * into cabin_row;

  event_result := public.service_record_point_event(
    'CABIN_CREATED',
    profile_row.email,
    actor,
    null,
    null,
    'cabin',
    cabin_row.id,
    season_row.id,
    season_member_row.id,
    null,
    null,
    cabin_row.id,
    null,
    null,
    jsonb_build_object('cabinName', cabin_row.name),
    now()
  );

  insert into public.gpe_notification_outbox (event_type, user_id, membership_id, season_id, payload, status)
  values (
    'new_group_chat_created',
    actor,
    season_member_row.id,
    season_row.id,
    jsonb_build_object('source', 'cabin', 'cabinId', cabin_row.id, 'conversationId', cabin_row.conversation_id),
    'pending'
  );

  insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
  values (actor, 'cabin', cabin_row.id, 'created', jsonb_build_object('conversationId', cabin_row.conversation_id, 'seasonMemberId', season_member_row.id, 'pointEvent', event_result));

  return jsonb_build_object(
    'ok', true,
    'cabinId', cabin_row.id,
    'seasonId', season_row.id,
    'seasonMemberId', season_member_row.id,
    'conversationId', cabin_row.conversation_id,
    'linkedConversation', linked_result
  );
end;
$$;

revoke all on function public.create_hub_cabin(jsonb) from public;
grant execute on function public.create_hub_cabin(jsonb) to authenticated;

create or replace function public.request_join_hub_cabin(
  p_cabin_id uuid,
  p_introduction text default null,
  p_join_reason text default null,
  p_rules_consent boolean default false
)
returns public.hub_cabin_members
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  cabin_row public.gpe_cabins%rowtype;
  member_row public.hub_cabin_members%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  if not public.profile_has_active_membership(actor) then
    raise exception 'Active GPE membership is required to join a cabin.';
  end if;

  select * into cabin_row
  from public.gpe_cabins
  where id = p_cabin_id
    and status = 'active';

  if not found then
    raise exception 'Cabin not found.';
  end if;

  insert into public.hub_cabin_members (
    cabin_id,
    profile_id,
    role,
    status,
    introduction,
    join_reason,
    rules_consent
  )
  values (
    p_cabin_id,
    actor,
    'member',
    case when cabin_row.approval_required then 'requested' else 'approved' end::public.hub_cabin_member_status,
    nullif(trim(coalesce(p_introduction, '')), ''),
    nullif(trim(coalesce(p_join_reason, '')), ''),
    coalesce(p_rules_consent, false)
  )
  on conflict (cabin_id, profile_id) do update
  set introduction = coalesce(excluded.introduction, public.hub_cabin_members.introduction),
      join_reason = coalesce(excluded.join_reason, public.hub_cabin_members.join_reason),
      rules_consent = excluded.rules_consent,
      updated_at = now()
  returning * into member_row;

  insert into public.gpe_notification_outbox (event_type, user_id, payload, status)
  values (
    'cabin_join_request',
    cabin_row.lead_profile_id,
    jsonb_build_object('cabinId', cabin_row.id, 'memberRequestId', member_row.id, 'requesterProfileId', actor),
    'pending'
  );

  return member_row;
end;
$$;

revoke all on function public.request_join_hub_cabin(uuid, text, text, boolean) from public;
grant execute on function public.request_join_hub_cabin(uuid, text, text, boolean) to authenticated;

create or replace function public.respond_hub_cabin_membership(
  p_cabin_member_id uuid,
  p_decision text,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  member_row public.hub_cabin_members%rowtype;
  cabin_row public.gpe_cabins%rowtype;
  profile_row public.profiles%rowtype;
  season_member_row public.gpe_season_members%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  select * into member_row
  from public.hub_cabin_members
  where id = p_cabin_member_id
  for update;

  if not found then
    raise exception 'Cabin membership request not found.';
  end if;

  select * into cabin_row
  from public.gpe_cabins
  where id = member_row.cabin_id;

  if not found then
    raise exception 'Cabin not found.';
  end if;

  if actor <> cabin_row.lead_profile_id and not public.can_manage_camp(actor) then
    raise exception 'Only the cabin lead or Team GPE can review this cabin request.';
  end if;

  if lower(coalesce(p_decision, '')) not in ('approved', 'declined', 'removed') then
    raise exception 'Decision must be approved, declined, or removed.';
  end if;

  if member_row.status in ('approved', 'active') and lower(p_decision) = 'approved' then
    return jsonb_build_object(
      'ok', true,
      'alreadyProcessed', true,
      'cabinMemberId', member_row.id,
      'seasonMemberId', member_row.season_member_id,
      'conversationId', cabin_row.conversation_id,
      'status', member_row.status
    );
  end if;

  if lower(p_decision) <> 'approved' then
    update public.hub_cabin_members
    set status = lower(p_decision)::public.hub_cabin_member_status,
        reviewed_by = actor,
        reviewed_at = now(),
        updated_at = now()
    where id = member_row.id
    returning * into member_row;

    insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
    values (actor, 'cabin_member', member_row.id, lower(p_decision), jsonb_build_object('note', p_response_note));

    return jsonb_build_object('ok', true, 'status', member_row.status, 'cabinMemberId', member_row.id);
  end if;

  if not public.profile_has_active_membership(member_row.profile_id) then
    raise exception 'Active GPE membership is required before a member can join a cabin.';
  end if;

  select * into profile_row from public.profiles where id = member_row.profile_id;

  if nullif(trim(coalesce(profile_row.email, '')), '') is null then
    raise exception 'The selected Hub profile does not have an email address.';
  end if;

  insert into public.gpe_season_members (
    season_id,
    user_id,
    neon_account_id,
    contact_email,
    cabin_id,
    status
  )
  values (
    cabin_row.season_id,
    member_row.profile_id,
    profile_row.neon_account_id,
    lower(profile_row.email),
    cabin_row.id,
    'active'
  )
  on conflict (season_id, user_id) do update
  set cabin_id = excluded.cabin_id,
      neon_account_id = coalesce(public.gpe_season_members.neon_account_id, excluded.neon_account_id),
      contact_email = excluded.contact_email,
      status = case when public.gpe_season_members.status = 'withdrawn' then public.gpe_season_members.status else 'active'::public.gpe_season_member_status end,
      updated_at = now()
  returning * into season_member_row;

  update public.hub_cabin_members
  set season_member_id = season_member_row.id,
      status = 'active',
      reviewed_by = actor,
      reviewed_at = now(),
      updated_at = now()
  where id = member_row.id
  returning * into member_row;

  if cabin_row.conversation_id is not null then
    insert into public.conversation_participants (conversation_id, profile_id)
    values (cabin_row.conversation_id, member_row.profile_id)
    on conflict on constraint conversation_participants_conversation_profile_unique do nothing;
  end if;

  perform public.service_record_point_event(
    'CABIN_JOINED',
    profile_row.email,
    member_row.profile_id,
    null,
    null,
    'cabin_member',
    member_row.id,
    cabin_row.season_id,
    season_member_row.id,
    null,
    null,
    cabin_row.id,
    null,
    null,
    jsonb_build_object('cabinId', cabin_row.id, 'cabinName', cabin_row.name),
    now()
  );

  insert into public.gpe_notification_outbox (event_type, user_id, membership_id, season_id, payload, status)
  values (
    'cabin_request_approved',
    member_row.profile_id,
    season_member_row.id,
    cabin_row.season_id,
    jsonb_build_object('cabinId', cabin_row.id, 'conversationId', cabin_row.conversation_id),
    'pending'
  );

  insert into public.hub_match_activity (actor_profile_id, entity_type, entity_id, action, metadata)
  values (actor, 'cabin_member', member_row.id, 'approved', jsonb_build_object('seasonMemberId', season_member_row.id, 'conversationId', cabin_row.conversation_id));

  return jsonb_build_object(
    'ok', true,
    'status', member_row.status,
    'cabinMemberId', member_row.id,
    'seasonMemberId', season_member_row.id,
    'conversationId', cabin_row.conversation_id
  );
end;
$$;

revoke all on function public.respond_hub_cabin_membership(uuid, text, text) from public;
grant execute on function public.respond_hub_cabin_membership(uuid, text, text) to authenticated;
