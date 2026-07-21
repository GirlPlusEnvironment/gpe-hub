do $$
begin
  if not exists (select 1 from pg_type where typname = 'gpe_review_status') then
    create type public.gpe_review_status as enum (
      'pending',
      'approved',
      'rejected',
      'needs_information',
      'duplicate',
      'archived'
    );
  end if;
end
$$;

alter table public.point_transactions
add column if not exists source text,
add column if not exists source_id uuid,
add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists point_transactions_submission_approval_unique
on public.point_transactions (source, source_id)
where source = 'submission_approval'
  and source_id is not null
  and points_earned > 0;

do $$
begin
  if exists (select 1 from pg_type where typname = 'gpe_camp_review_status')
    and not exists (
      select 1
      from pg_enum
      where enumtypid = 'public.gpe_camp_review_status'::regtype
        and enumlabel = 'needs_information'
    ) then
    alter type public.gpe_camp_review_status add value 'needs_information';
  end if;
end
$$;

alter table public.gpe_camp_challenge_submissions
add column if not exists member_visible_note text;

alter table public.gpe_camp_submission_actions
add column if not exists member_visible_note text;

create table if not exists public.gpe_review_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_type text not null,
  submission_status public.gpe_review_status not null default 'pending',
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_email text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  member_visible_note text,
  points_awarded integer not null default 0,
  season_id uuid references public.gpe_seasons(id) on delete set null,
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_review_submissions_status_points check (
    submission_status = 'approved'
    or points_awarded = 0
  ),
  constraint gpe_review_submissions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists gpe_review_submissions_source_unique
on public.gpe_review_submissions (source_table, source_id)
where source_table is not null and source_id is not null;

create index if not exists gpe_review_submissions_status_idx
on public.gpe_review_submissions (submission_type, submission_status, submitted_at desc);

create index if not exists gpe_review_submissions_submitted_by_idx
on public.gpe_review_submissions (submitted_by, submitted_at desc);

drop trigger if exists update_gpe_review_submissions_updated_at on public.gpe_review_submissions;
create trigger update_gpe_review_submissions_updated_at
before update on public.gpe_review_submissions
for each row execute function public.update_updated_at_column();

create or replace function public.normalize_gpe_review_status(p_status text)
returns public.gpe_review_status
language sql
immutable
as $$
  select case lower(coalesce(nullif(trim(p_status), ''), 'pending'))
    when 'approved' then 'approved'::public.gpe_review_status
    when 'rejected' then 'rejected'::public.gpe_review_status
    when 'needs_info' then 'needs_information'::public.gpe_review_status
    when 'needs_information' then 'needs_information'::public.gpe_review_status
    when 'duplicate' then 'duplicate'::public.gpe_review_status
    when 'archived' then 'archived'::public.gpe_review_status
    else 'pending'::public.gpe_review_status
  end
$$;

create or replace function public.upsert_review_submission_from_camp_action(p_action_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.gpe_camp_submission_actions%rowtype;
  submission_row public.gpe_camp_challenge_submissions%rowtype;
  review_id uuid;
begin
  select * into action_row
  from public.gpe_camp_submission_actions
  where id = p_action_id;
  if not found then
    raise exception 'Camp submission action not found.';
  end if;

  select * into submission_row
  from public.gpe_camp_challenge_submissions
  where id = action_row.submission_id;
  if not found then
    raise exception 'Camp submission not found.';
  end if;

  insert into public.gpe_review_submissions (
    submission_type,
    submission_status,
    submitted_by,
    submitted_email,
    reviewed_by,
    review_notes,
    member_visible_note,
    points_awarded,
    season_id,
    source_table,
    source_id,
    metadata,
    submitted_at,
    reviewed_at
  )
  values (
    'camp',
    public.normalize_gpe_review_status(action_row.review_status::text),
    submission_row.user_id,
    submission_row.contact_email,
    action_row.reviewed_by,
    action_row.reviewer_notes,
    action_row.member_visible_note,
    coalesce(action_row.approved_points, 0),
    submission_row.season_id,
    'gpe_camp_submission_actions',
    action_row.id,
    jsonb_build_object(
      'submission_id', submission_row.id,
      'challenge_id', action_row.challenge_id,
      'other_description', action_row.other_description,
      'proof_urls', action_row.proof_urls,
      'member_link_status', submission_row.member_link_status
    ),
    action_row.created_at,
    action_row.reviewed_at
  )
  on conflict (source_table, source_id)
  do update set
    submission_status = excluded.submission_status,
    submitted_by = excluded.submitted_by,
    submitted_email = excluded.submitted_email,
    reviewed_by = excluded.reviewed_by,
    review_notes = excluded.review_notes,
    member_visible_note = excluded.member_visible_note,
    points_awarded = excluded.points_awarded,
    season_id = excluded.season_id,
    metadata = excluded.metadata,
    reviewed_at = excluded.reviewed_at
  returning id into review_id;

  return review_id;
end;
$$;

create or replace function public.approve_submission(
  p_submission_type text,
  p_source_id uuid,
  p_points integer default null,
  p_review_notes text default null,
  p_member_visible_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  review_row public.gpe_review_submissions%rowtype;
  general_transaction_id uuid;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to review submissions.';
  end if;

  if p_submission_type = 'camp' then
    perform public.approve_camp_submission_action(p_source_id, p_points, p_review_notes);

    update public.gpe_camp_submission_actions
    set member_visible_note = nullif(trim(coalesce(p_member_visible_note, '')), '')
    where id = p_source_id;

    return jsonb_build_object(
      'submission_type', 'camp',
      'source_id', p_source_id,
      'review_submission_id', public.upsert_review_submission_from_camp_action(p_source_id)
    );
  end if;

  select * into review_row
  from public.gpe_review_submissions
  where source_id = p_source_id
    and submission_type = p_submission_type
  for update;
  if not found then
    raise exception 'Review submission not found.';
  end if;
  if review_row.submission_status = 'approved' then
    raise exception 'Submission is already approved.';
  end if;

  if review_row.submitted_by is not null and coalesce(p_points, 0) <> 0 then
    update public.profiles
    set points = greatest(0, points + coalesce(p_points, 0)),
        updated_at = now()
    where id = review_row.submitted_by;

    insert into public.point_transactions (
      user_id,
      points_earned,
      source,
      source_id,
      metadata
    )
    values (
      review_row.submitted_by,
      coalesce(p_points, 0),
      'submission_approval',
      review_row.id,
      jsonb_build_object(
        'submission_type', review_row.submission_type,
        'source_table', review_row.source_table,
        'source_id', review_row.source_id,
        'reviewer_id', actor,
        'reviewer_notes', p_review_notes
      )
    )
    returning id into general_transaction_id;
  end if;

  update public.gpe_review_submissions
  set
    submission_status = 'approved',
    reviewed_by = actor,
    reviewed_at = now(),
    review_notes = nullif(trim(coalesce(p_review_notes, '')), ''),
    member_visible_note = nullif(trim(coalesce(p_member_visible_note, '')), ''),
    points_awarded = coalesce(p_points, 0),
    metadata = metadata || jsonb_build_object('point_transaction_id', general_transaction_id)
  where id = review_row.id;

  perform public.emit_gpe_notification(
    'submission_approved',
    review_row.submitted_by,
    null,
    review_row.season_id,
    null,
    null,
    jsonb_build_object('points', coalesce(p_points, 0), 'submission_type', review_row.submission_type)
  );

  return jsonb_build_object('review_submission_id', review_row.id, 'point_transaction_id', general_transaction_id);
end;
$$;

create or replace function public.review_submission(
  p_submission_type text,
  p_source_id uuid,
  p_status public.gpe_review_status,
  p_review_notes text default null,
  p_member_visible_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  review_id uuid;
  review_row public.gpe_review_submissions%rowtype;
  event_name text;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to review submissions.';
  end if;
  if p_status = 'approved' then
    raise exception 'Use approve_submission to approve and award points.';
  end if;

  if p_submission_type = 'camp' then
    if p_status = 'archived' then
      raise exception 'Camp submissions cannot be archived through review_submission.';
    end if;

    perform public.mark_camp_submission_action(
      p_source_id,
      p_status::text::public.gpe_camp_submission_action_status,
      p_review_notes
    );
    update public.gpe_camp_submission_actions
    set member_visible_note = nullif(trim(coalesce(p_member_visible_note, '')), '')
    where id = p_source_id;
    review_id := public.upsert_review_submission_from_camp_action(p_source_id);

    select * into review_row
    from public.gpe_review_submissions
    where id = review_id;
  else
    update public.gpe_review_submissions
    set
      submission_status = p_status,
      reviewed_by = actor,
      reviewed_at = now(),
      review_notes = nullif(trim(coalesce(p_review_notes, '')), ''),
      member_visible_note = nullif(trim(coalesce(p_member_visible_note, '')), '')
    where source_id = p_source_id
      and submission_type = p_submission_type
    returning * into review_row;
    review_id := review_row.id;
  end if;

  event_name := case p_status
    when 'needs_information' then 'submission_needs_information'
    when 'rejected' then 'submission_rejected'
    when 'duplicate' then 'submission_duplicate'
    else 'submission_review_updated'
  end;

  perform public.emit_gpe_notification(
    event_name,
    review_row.submitted_by,
    null,
    review_row.season_id,
    null,
    null,
    jsonb_build_object(
      'submission_type', review_row.submission_type,
      'status', p_status,
      'member_visible_note', p_member_visible_note
    )
  );

  return jsonb_build_object('review_submission_id', review_id, 'event', event_name);
end;
$$;

alter table public.gpe_review_submissions enable row level security;

drop policy if exists "gpe_review_submissions_select_own" on public.gpe_review_submissions;
create policy "gpe_review_submissions_select_own"
on public.gpe_review_submissions
for select
to authenticated
using (submitted_by = auth.uid());

drop policy if exists "gpe_review_submissions_insert_own" on public.gpe_review_submissions;
create policy "gpe_review_submissions_insert_own"
on public.gpe_review_submissions
for insert
to authenticated
with check (submitted_by = auth.uid());

drop policy if exists "gpe_review_submissions_manage_team" on public.gpe_review_submissions;
create policy "gpe_review_submissions_manage_team"
on public.gpe_review_submissions
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

grant execute on function public.normalize_gpe_review_status(text) to authenticated;
revoke all on function public.upsert_review_submission_from_camp_action(uuid) from public, anon, authenticated;
grant execute on function public.approve_submission(text, uuid, integer, text, text) to authenticated;
grant execute on function public.review_submission(text, uuid, public.gpe_review_status, text, text) to authenticated;
