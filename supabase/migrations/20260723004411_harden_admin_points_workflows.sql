create table if not exists public.hub_point_rules (
  action_type text primary key,
  display_name text not null,
  point_value integer not null,
  active boolean not null default true,
  counts_for_ongoing boolean not null default true,
  counts_for_season boolean not null default false,
  counts_for_cabin boolean not null default false,
  requires_approval boolean not null default false,
  max_awards_per_user integer,
  cooldown interval,
  duplicate_strategy text not null default 'source_once',
  season_override uuid references public.gpe_seasons(id) on delete set null,
  effective_start timestamptz,
  effective_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hub_point_rules_point_value_check check (point_value >= 0),
  constraint hub_point_rules_duplicate_strategy_check check (duplicate_strategy in ('source_once', 'daily_cap', 'manual_review', 'unlimited'))
);

alter table public.hub_point_rules enable row level security;

drop policy if exists hub_point_rules_read_authenticated on public.hub_point_rules;
create policy hub_point_rules_read_authenticated
on public.hub_point_rules
for select
to authenticated
using (true);

drop policy if exists hub_point_rules_manage_admin on public.hub_point_rules;
create policy hub_point_rules_manage_admin
on public.hub_point_rules
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

grant select on public.hub_point_rules to authenticated;

insert into public.hub_point_rules (
  action_type,
  display_name,
  point_value,
  active,
  counts_for_ongoing,
  counts_for_season,
  counts_for_cabin,
  requires_approval,
  max_awards_per_user,
  duplicate_strategy,
  metadata
)
values
  ('job_submission', 'Submit a job opportunity', 10, true, true, false, false, false, null, 'source_once', '{"source":"listing_insert_trigger"}'::jsonb),
  ('hub_post', 'Create a Hub post', 10, false, true, false, false, false, 1, 'daily_cap', '{"disabled_reason":"client-side awarding removed pending server trigger"}'::jsonb),
  ('hub_comment', 'Create a Hub comment', 2, false, true, false, false, false, 5, 'daily_cap', '{"disabled_reason":"farmable action disabled"}'::jsonb),
  ('message_send', 'Send a member message', 0, false, true, false, false, false, 0, 'daily_cap', '{"disabled_reason":"farmable action disabled"}'::jsonb),
  ('listing_favorite', 'Favorite a listing', 0, false, true, false, false, false, 0, 'daily_cap', '{"disabled_reason":"farmable action disabled"}'::jsonb),
  ('manual_admin_award', 'Manual admin award', 0, true, true, false, false, true, null, 'source_once', '{"source":"admin_rpc"}'::jsonb),
  ('manual_camp_award', 'Manual Camp award', 0, true, true, true, true, true, null, 'source_once', '{"source":"admin_rpc"}'::jsonb)
on conflict (action_type) do update set
  display_name = excluded.display_name,
  point_value = excluded.point_value,
  active = excluded.active,
  counts_for_ongoing = excluded.counts_for_ongoing,
  counts_for_season = excluded.counts_for_season,
  counts_for_cabin = excluded.counts_for_cabin,
  requires_approval = excluded.requires_approval,
  max_awards_per_user = excluded.max_awards_per_user,
  duplicate_strategy = excluded.duplicate_strategy,
  metadata = public.hub_point_rules.metadata || excluded.metadata,
  updated_at = now();

create or replace function public.uuid_from_text(p_value text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(coalesce(p_value, '')), 1, 8) || '-' ||
    substr(md5(coalesce(p_value, '')), 9, 4) || '-' ||
    substr(md5(coalesce(p_value, '')), 13, 4) || '-' ||
    substr(md5(coalesce(p_value, '')), 17, 4) || '-' ||
    substr(md5(coalesce(p_value, '')), 21, 12)
  )::uuid;
$$;

create or replace function public.award_scoped_hub_points(
  p_user_id uuid,
  p_points integer,
  p_source text,
  p_source_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_action_type text default null,
  p_season_id uuid default null,
  p_challenge_id uuid default null,
  p_season_member_id uuid default null,
  p_cabin_id uuid default null,
  p_counts_for_ongoing boolean default true,
  p_counts_for_season boolean default false,
  p_counts_for_cabin boolean default false,
  p_approval_status text default 'approved',
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  transaction_id uuid;
  trusted_listing_award boolean := false;
begin
  trusted_listing_award :=
    p_source = 'listing_submission'
    and coalesce(p_action_type, '') = 'job_submission'
    and p_user_id = actor
    and coalesce(p_counts_for_ongoing, true)
    and not coalesce(p_counts_for_season, false)
    and not coalesce(p_counts_for_cabin, false)
    and exists (
      select 1
      from public.listings l
      where l.id = p_source_id
        and l.submitted_by = actor
        and l.category = 'jobs'
    );

  if actor is null or (not public.can_manage_camp(actor) and not trusted_listing_award) then
    raise exception 'Not authorized to award Hub points.';
  end if;
  if p_user_id is null then
    raise exception 'Point award requires a Hub profile.';
  end if;
  if p_points = 0 then
    return null;
  end if;
  if p_points < 0 and not public.can_manage_camp(actor) then
    raise exception 'Only admins can create negative point entries.';
  end if;
  if nullif(trim(coalesce(p_source, '')), '') is null or p_source_id is null then
    raise exception 'Point award requires an idempotent source.';
  end if;
  if p_approval_status not in ('approved', 'pending', 'rejected', 'duplicate', 'manual_review', 'reversed') then
    raise exception 'Unsupported point approval status: %', p_approval_status;
  end if;
  if coalesce(p_counts_for_season, false) and p_season_id is null then
    raise exception 'Season-scoped points require season_id.';
  end if;
  if coalesce(p_counts_for_cabin, false) and (p_season_id is null or p_cabin_id is null) then
    raise exception 'Cabin-scoped points require season_id and cabin_id.';
  end if;

  select id into transaction_id
  from public.point_transactions
  where source = p_source
    and source_id = p_source_id
    and points_earned > 0
  limit 1;

  if transaction_id is not null and p_points > 0 then
    return transaction_id;
  end if;

  insert into public.point_transactions (
    user_id,
    points_earned,
    source,
    source_id,
    metadata,
    action_type,
    season_id,
    challenge_id,
    season_member_id,
    cabin_id,
    counts_for_ongoing,
    counts_for_season,
    counts_for_cabin,
    approval_status,
    occurred_at,
    created_at
  )
  values (
    p_user_id,
    p_points,
    p_source,
    p_source_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('awarded_by', actor),
    coalesce(nullif(trim(p_action_type), ''), p_source),
    p_season_id,
    p_challenge_id,
    p_season_member_id,
    case when coalesce(p_counts_for_cabin, false) then p_cabin_id else null end,
    coalesce(p_counts_for_ongoing, true),
    coalesce(p_counts_for_season, false),
    coalesce(p_counts_for_cabin, false),
    p_approval_status,
    coalesce(p_occurred_at, now()),
    coalesce(p_occurred_at, now())
  )
  returning id into transaction_id;

  if coalesce(p_counts_for_ongoing, true) and p_approval_status = 'approved' then
    update public.profiles
    set points = greatest(0, points + p_points),
        updated_at = now()
    where id = p_user_id;
  end if;

  return transaction_id;
end;
$$;

revoke all on function public.award_scoped_hub_points(uuid, integer, text, uuid, jsonb, text, uuid, uuid, uuid, uuid, boolean, boolean, boolean, text, timestamptz) from public;

create or replace function public.award_job_listing_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule_row public.hub_point_rules%rowtype;
  transaction_id uuid;
begin
  if new.category <> 'jobs' then
    return new;
  end if;

  select * into rule_row
  from public.hub_point_rules
  where action_type = 'job_submission'
    and active
    and (effective_start is null or effective_start <= now())
    and (effective_end is null or effective_end >= now())
  limit 1;

  if not found or rule_row.point_value <= 0 then
    return new;
  end if;

  transaction_id := public.award_scoped_hub_points(
    new.submitted_by,
    rule_row.point_value,
    'listing_submission',
    new.id,
    jsonb_build_object('listing_id', new.id, 'listing_category', new.category, 'rule_action_type', rule_row.action_type),
    'job_submission',
    null,
    null,
    null,
    null,
    rule_row.counts_for_ongoing,
    false,
    false,
    'approved',
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists listings_award_job_points on public.listings;
create trigger listings_award_job_points
after insert on public.listings
for each row
execute function public.award_job_listing_points();

create or replace function public.admin_search_point_members(
  p_query text,
  p_season_id uuid default null,
  p_limit integer default 25
)
returns table (
  profile_id uuid,
  season_member_id uuid,
  full_name text,
  first_name text,
  last_name text,
  email text,
  membership_status text,
  neon_account_id text,
  ongoing_points integer,
  seasonal_points integer,
  cabin_points integer,
  cabin_id uuid,
  cabin_name text,
  season_id uuid,
  result_rank integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  normalized_query text := lower(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g'));
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to search point members.';
  end if;
  if length(normalized_query) < 2 then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id as profile_id,
      sm.id as season_member_id,
      p.full_name,
      p.first_name,
      p.last_name,
      p.email,
      coalesce(p.membership_access_state, p.member_status) as membership_status,
      coalesce(p.neon_account_id, sm.neon_account_id) as neon_account_id,
      coalesce(sum(pt.points_earned) filter (
        where pt.counts_for_ongoing and pt.approval_status = 'approved'
      ), 0)::integer as ongoing_points,
      coalesce(sum(pt.points_earned) filter (
        where p_season_id is not null
          and pt.season_id = p_season_id
          and pt.counts_for_season
          and pt.approval_status = 'approved'
      ), 0)::integer as seasonal_points,
      coalesce(sum(pt.points_earned) filter (
        where p_season_id is not null
          and pt.season_id = p_season_id
          and pt.counts_for_cabin
          and pt.approval_status = 'approved'
      ), 0)::integer as cabin_points,
      sm.cabin_id,
      c.name as cabin_name,
      sm.season_id,
      case
        when p.id::text = normalized_query then 1
        when lower(coalesce(p.email, '')) = normalized_query then 2
        when lower(coalesce(p.neon_account_id, sm.neon_account_id, '')) = normalized_query then 3
        when lower(regexp_replace(trim(coalesce(p.full_name, '')), '\s+', ' ', 'g')) = normalized_query then 4
        when lower(coalesce(p.first_name, '')) = normalized_query then 5
        when lower(coalesce(p.last_name, '')) = normalized_query then 6
        else 10
      end as result_rank
    from public.profiles p
    left join public.gpe_season_members sm
      on sm.user_id = p.id
     and (p_season_id is null or sm.season_id = p_season_id)
    left join public.gpe_cabins c
      on c.id = sm.cabin_id
    left join public.point_transactions pt
      on pt.user_id = p.id
    where p.id::text = normalized_query
       or lower(coalesce(p.email, '')) like '%' || normalized_query || '%'
       or lower(coalesce(p.neon_account_id, '')) like '%' || normalized_query || '%'
       or lower(coalesce(sm.neon_account_id, '')) like '%' || normalized_query || '%'
       or lower(coalesce(p.first_name, '')) like '%' || normalized_query || '%'
       or lower(coalesce(p.last_name, '')) like '%' || normalized_query || '%'
       or lower(regexp_replace(trim(coalesce(p.full_name, '')), '\s+', ' ', 'g')) like '%' || normalized_query || '%'
       or lower(regexp_replace(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '\s+', ' ', 'g')) like '%' || normalized_query || '%'
    group by p.id, sm.id, c.name
  )
  select *
  from candidates
  order by result_rank asc, full_name nulls last, email nulls last
  limit greatest(coalesce(p_limit, 25), 1);
end;
$$;

create or replace function public.admin_get_member_point_history(
  p_profile_id uuid,
  p_season_id uuid default null,
  p_limit integer default 25
)
returns table (
  transaction_id uuid,
  points integer,
  action_type text,
  source text,
  source_id uuid,
  reason text,
  admin_note text,
  counts_for_ongoing boolean,
  counts_for_season boolean,
  counts_for_cabin boolean,
  approval_status text,
  season_id uuid,
  season_member_id uuid,
  challenge_id uuid,
  cabin_id uuid,
  occurred_at timestamptz,
  created_at timestamptz,
  awarded_by uuid,
  reversed_by_transaction_id uuid,
  reverses_transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to view point history.';
  end if;

  return query
  select
    pt.id,
    pt.points_earned,
    pt.action_type,
    pt.source,
    pt.source_id,
    coalesce(pt.metadata->>'reason', pt.metadata->>'rule_action_type', pt.action_type, pt.source) as reason,
    pt.metadata->>'admin_note' as admin_note,
    pt.counts_for_ongoing,
    pt.counts_for_season,
    pt.counts_for_cabin,
    pt.approval_status,
    pt.season_id,
    pt.season_member_id,
    pt.challenge_id,
    pt.cabin_id,
    pt.occurred_at,
    pt.created_at,
    nullif(pt.metadata->>'awarded_by', '')::uuid as awarded_by,
    nullif(pt.metadata->>'reversal_transaction_id', '')::uuid as reversed_by_transaction_id,
    nullif(pt.metadata->>'reverses_transaction_id', '')::uuid as reverses_transaction_id
  from public.point_transactions pt
  where pt.user_id = p_profile_id
    and (p_season_id is null or pt.season_id = p_season_id or pt.season_id is null)
  order by pt.occurred_at desc, pt.created_at desc
  limit greatest(coalesce(p_limit, 25), 1);
end;
$$;

create or replace function public.admin_award_manual_points(
  p_profile_id uuid,
  p_points integer,
  p_reason text,
  p_action_type text default 'manual_admin_award',
  p_admin_note text default null,
  p_season_id uuid default null,
  p_challenge_id uuid default null,
  p_cabin_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_counts_for_ongoing boolean default true,
  p_counts_for_season boolean default false,
  p_counts_for_cabin boolean default false,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  profile_row public.profiles%rowtype;
  season_row public.gpe_seasons%rowtype;
  member_row public.gpe_season_members%rowtype;
  challenge_row public.gpe_challenges%rowtype;
  source_uuid uuid;
  transaction_id uuid;
  ledger_id uuid;
  existing_id uuid;
  effective_action_type text := coalesce(nullif(trim(p_action_type), ''), 'manual_admin_award');
  effective_key text;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to manually award points.';
  end if;
  if p_profile_id is null then
    raise exception 'A member profile is required.';
  end if;
  if p_points = 0 then
    raise exception 'Manual point award cannot be zero.';
  end if;
  if abs(p_points) > 10000 then
    raise exception 'Manual point award is too large.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Manual point award requires a reason.';
  end if;
  if p_counts_for_cabin and not p_counts_for_season then
    raise exception 'Cabin points must also count for the season.';
  end if;

  select * into profile_row from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'Profile not found.';
  end if;

  if p_season_id is not null then
    select * into season_row from public.gpe_seasons where id = p_season_id;
    if not found then
      raise exception 'Season not found.';
    end if;

    select * into member_row
    from public.gpe_season_members
    where season_id = p_season_id
      and user_id = p_profile_id
    order by joined_at desc
    limit 1;

    if not found and (p_counts_for_season or p_counts_for_cabin) then
      raise exception 'Selected profile is not linked to this season.';
    end if;
  elsif p_counts_for_season or p_counts_for_cabin then
    raise exception 'Season points require a season.';
  end if;

  if p_challenge_id is not null then
    select * into challenge_row
    from public.gpe_challenges
    where id = p_challenge_id
      and (p_season_id is null or season_id = p_season_id);
    if not found then
      raise exception 'Challenge not found for selected season.';
    end if;
  end if;

  if p_counts_for_cabin then
    if coalesce(p_cabin_id, member_row.cabin_id) is null then
      raise exception 'Cabin-scoped points require a cabin.';
    end if;
    if not exists (
      select 1 from public.gpe_cabins c
      where c.id = coalesce(p_cabin_id, member_row.cabin_id)
        and c.season_id = p_season_id
    ) then
      raise exception 'Cabin not found for selected season.';
    end if;
  end if;

  effective_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'manual:' || p_profile_id || ':' || coalesce(p_season_id::text, 'ongoing') || ':' || effective_action_type || ':' || coalesce(p_reason, '') || ':' || coalesce(p_occurred_at::text, now()::text)
  );
  source_uuid := public.uuid_from_text(effective_key);

  select id into existing_id
  from public.point_transactions
  where source = 'manual_admin_award'
    and source_id = source_uuid
  limit 1;

  transaction_id := public.award_scoped_hub_points(
    p_profile_id,
    p_points,
    'manual_admin_award',
    source_uuid,
    jsonb_build_object(
      'reason', p_reason,
      'admin_note', p_admin_note,
      'idempotency_key', effective_key,
      'manual_award', true
    ),
    effective_action_type,
    p_season_id,
    p_challenge_id,
    member_row.id,
    coalesce(p_cabin_id, member_row.cabin_id),
    coalesce(p_counts_for_ongoing, true),
    coalesce(p_counts_for_season, false),
    coalesce(p_counts_for_cabin, false),
    'approved',
    coalesce(p_occurred_at, now())
  );

  if p_season_id is not null and coalesce(p_counts_for_season, false) then
    insert into public.gpe_camp_points_ledger (
      season_id,
      season_member_id,
      user_id,
      challenge_id,
      points,
      reason,
      adjustment_type,
      entry_type,
      source,
      created_by,
      awarded_by,
      metadata,
      general_point_transaction_id,
      counts_for_ongoing,
      counts_for_season,
      counts_for_cabin,
      cabin_id_at_award,
      approval_status,
      occurred_at,
      created_at
    )
    select
      p_season_id,
      member_row.id,
      p_profile_id,
      p_challenge_id,
      p_points,
      p_reason,
      'manual',
      case when p_points >= 0 then 'manual_adjustment'::public.gpe_point_entry_type else 'penalty'::public.gpe_point_entry_type end,
      'manual_admin_award',
      actor,
      actor,
      jsonb_build_object('admin_note', p_admin_note, 'point_transaction_id', transaction_id, 'idempotency_key', effective_key),
      transaction_id,
      coalesce(p_counts_for_ongoing, true),
      true,
      coalesce(p_counts_for_cabin, false),
      case when coalesce(p_counts_for_cabin, false) then coalesce(p_cabin_id, member_row.cabin_id) else null end,
      'approved',
      coalesce(p_occurred_at, now()),
      coalesce(p_occurred_at, now())
    where not exists (
      select 1
      from public.gpe_camp_points_ledger existing
      where existing.general_point_transaction_id = transaction_id
    )
    returning id into ledger_id;
  end if;

  return jsonb_build_object(
    'point_transaction_id', transaction_id,
    'camp_ledger_id', ledger_id,
    'duplicate', existing_id is not null,
    'points', p_points,
    'counts_for_ongoing', coalesce(p_counts_for_ongoing, true),
    'counts_for_season', coalesce(p_counts_for_season, false),
    'counts_for_cabin', coalesce(p_counts_for_cabin, false)
  );
end;
$$;

create or replace function public.admin_reverse_point_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  original public.point_transactions%rowtype;
  reversal_id uuid;
  ledger_row public.gpe_camp_points_ledger%rowtype;
  reversal_ledger_id uuid;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to reverse points.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reversal requires a reason.';
  end if;

  select * into original
  from public.point_transactions
  where id = p_transaction_id
  for update;
  if not found then
    raise exception 'Point transaction not found.';
  end if;
  if original.points_earned < 0 or original.metadata ? 'reversal_transaction_id' then
    raise exception 'This transaction has already been reversed or is itself a reversal.';
  end if;

  reversal_id := public.award_scoped_hub_points(
    original.user_id,
    -original.points_earned,
    'point_reversal',
    original.id,
    jsonb_build_object(
      'reason', p_reason,
      'reverses_transaction_id', original.id,
      'reversed_by', actor
    ),
    coalesce(original.action_type, original.source, 'point_reversal') || '_reversal',
    original.season_id,
    original.challenge_id,
    original.season_member_id,
    original.cabin_id,
    original.counts_for_ongoing,
    original.counts_for_season,
    original.counts_for_cabin,
    'approved',
    now()
  );

  update public.point_transactions
  set metadata = metadata || jsonb_build_object(
        'reversal_transaction_id', reversal_id,
        'reversal_reason', p_reason,
        'reversed_by', actor,
        'reversed_at', now()
      )
  where id = original.id;

  select * into ledger_row
  from public.gpe_camp_points_ledger
  where general_point_transaction_id = original.id
    and reversed_at is null
  order by created_at desc
  limit 1;

  if found then
    update public.gpe_camp_points_ledger
    set reversed_by = actor,
        reversed_at = now(),
        reversal_reason = p_reason,
        approval_status = 'reversed'
    where id = ledger_row.id;

    insert into public.gpe_camp_points_ledger (
      season_id,
      season_member_id,
      user_id,
      submission_id,
      submission_action_id,
      challenge_id,
      points,
      reason,
      adjustment_type,
      entry_type,
      source,
      created_by,
      awarded_by,
      reversed_entry_id,
      metadata,
      general_point_transaction_id,
      counts_for_ongoing,
      counts_for_season,
      counts_for_cabin,
      cabin_id_at_award,
      approval_status,
      occurred_at,
      reversed_by,
      reversed_at,
      reversal_reason
    )
    values (
      ledger_row.season_id,
      ledger_row.season_member_id,
      ledger_row.user_id,
      ledger_row.submission_id,
      ledger_row.submission_action_id,
      ledger_row.challenge_id,
      -ledger_row.points,
      p_reason,
      'reversal',
      'reversal',
      'manual_reversal',
      actor,
      actor,
      ledger_row.id,
      jsonb_build_object('reverses_ledger_id', ledger_row.id, 'reversal_transaction_id', reversal_id),
      reversal_id,
      ledger_row.counts_for_ongoing,
      ledger_row.counts_for_season,
      ledger_row.counts_for_cabin,
      ledger_row.cabin_id_at_award,
      'reversed',
      now(),
      actor,
      now(),
      p_reason
    )
    returning id into reversal_ledger_id;
  end if;

  return jsonb_build_object(
    'reversal_transaction_id', reversal_id,
    'reversal_ledger_id', reversal_ledger_id,
    'reversed_transaction_id', original.id,
    'points_reversed', original.points_earned
  );
end;
$$;

grant execute on function public.admin_search_point_members(text, uuid, integer) to authenticated;
grant execute on function public.admin_get_member_point_history(uuid, uuid, integer) to authenticated;
grant execute on function public.admin_award_manual_points(uuid, integer, text, text, text, uuid, uuid, uuid, timestamptz, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.admin_reverse_point_transaction(uuid, text) to authenticated;
