alter table public.point_transactions
  add column if not exists action_type text,
  add column if not exists season_id uuid references public.gpe_seasons(id) on delete set null,
  add column if not exists challenge_id uuid references public.gpe_challenges(id) on delete set null,
  add column if not exists season_member_id uuid references public.gpe_season_members(id) on delete set null,
  add column if not exists cabin_id uuid references public.gpe_cabins(id) on delete set null,
  add column if not exists counts_for_ongoing boolean not null default true,
  add column if not exists counts_for_season boolean not null default false,
  add column if not exists counts_for_cabin boolean not null default false,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists occurred_at timestamptz not null default now();

alter table public.gpe_camp_points_ledger
  add column if not exists counts_for_ongoing boolean not null default true,
  add column if not exists counts_for_season boolean not null default true,
  add column if not exists counts_for_cabin boolean not null default false,
  add column if not exists cabin_id_at_award uuid references public.gpe_cabins(id) on delete set null,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists occurred_at timestamptz not null default now();

alter table public.gpe_event_cache
  add column if not exists season_id uuid references public.gpe_seasons(id) on delete set null,
  add column if not exists challenge_id uuid references public.gpe_challenges(id) on delete set null,
  add column if not exists counts_for_ongoing boolean not null default true,
  add column if not exists counts_for_season boolean not null default false,
  add column if not exists counts_for_cabin boolean not null default false;

update public.point_transactions
set
  action_type = coalesce(action_type, source, 'legacy'),
  counts_for_ongoing = coalesce(counts_for_ongoing, true),
  counts_for_season = coalesce(counts_for_season, false),
  counts_for_cabin = coalesce(counts_for_cabin, false),
  approval_status = coalesce(approval_status, 'approved'),
  occurred_at = coalesce(occurred_at, created_at, now())
where action_type is null
   or approval_status is null
   or occurred_at is null;

update public.gpe_camp_points_ledger ledger
set
  counts_for_ongoing = coalesce(ledger.counts_for_ongoing, true),
  counts_for_season = coalesce(ledger.counts_for_season, true),
  counts_for_cabin = coalesce(ledger.counts_for_cabin, sm.cabin_id is not null),
  cabin_id_at_award = coalesce(ledger.cabin_id_at_award, sm.cabin_id),
  approval_status = case
    when ledger.reversed_at is not null then 'reversed'
    else coalesce(ledger.approval_status, 'approved')
  end,
  occurred_at = coalesce(ledger.occurred_at, ledger.created_at, now())
from public.gpe_season_members sm
where sm.id = ledger.season_member_id
  and (
    ledger.cabin_id_at_award is null
    or ledger.approval_status is null
    or ledger.occurred_at is null
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'point_transactions_approval_status_check'
      and conrelid = 'public.point_transactions'::regclass
  ) then
    alter table public.point_transactions
      add constraint point_transactions_approval_status_check
      check (approval_status in ('approved', 'pending', 'rejected', 'duplicate', 'manual_review', 'reversed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'point_transactions_season_scope_check'
      and conrelid = 'public.point_transactions'::regclass
  ) then
    alter table public.point_transactions
      add constraint point_transactions_season_scope_check
      check (not counts_for_season or season_id is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'point_transactions_cabin_scope_check'
      and conrelid = 'public.point_transactions'::regclass
  ) then
    alter table public.point_transactions
      add constraint point_transactions_cabin_scope_check
      check (not counts_for_cabin or (season_id is not null and cabin_id is not null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gpe_camp_points_ledger_approval_status_check'
      and conrelid = 'public.gpe_camp_points_ledger'::regclass
  ) then
    alter table public.gpe_camp_points_ledger
      add constraint gpe_camp_points_ledger_approval_status_check
      check (approval_status in ('approved', 'pending', 'rejected', 'duplicate', 'manual_review', 'reversed'));
  end if;
end;
$$;

create index if not exists point_transactions_ongoing_approved_idx
on public.point_transactions (counts_for_ongoing, approval_status, occurred_at desc)
where counts_for_ongoing and approval_status = 'approved';

create index if not exists point_transactions_season_approved_idx
on public.point_transactions (season_id, counts_for_season, approval_status, occurred_at desc)
where counts_for_season and approval_status = 'approved';

create index if not exists point_transactions_cabin_approved_idx
on public.point_transactions (season_id, cabin_id, counts_for_cabin, approval_status)
where counts_for_cabin and approval_status = 'approved';

create or replace view public.gpe_ongoing_member_leaderboard
as
select
  p.id as user_id,
  p.username,
  p.full_name,
  p.avatar_url,
  coalesce(sum(pt.points_earned) filter (
    where pt.counts_for_ongoing
      and pt.approval_status = 'approved'
  ), 0)::integer as points,
  rank() over (
    order by coalesce(sum(pt.points_earned) filter (
      where pt.counts_for_ongoing
        and pt.approval_status = 'approved'
    ), 0) desc, p.created_at asc
  )::integer as rank,
  max(pt.occurred_at) filter (
    where pt.counts_for_ongoing
      and pt.approval_status = 'approved'
  ) as last_point_at
from public.profiles p
left join public.point_transactions pt
  on pt.user_id = p.id
group by p.id, p.username, p.full_name, p.avatar_url, p.created_at;

create or replace function public.get_ongoing_member_leaderboard(
  p_days integer default null,
  p_limit integer default 10
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  avatar_url text,
  points integer,
  rank integer,
  last_point_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with scored as (
    select
      p.id as user_id,
      p.username,
      p.full_name,
      p.avatar_url,
      coalesce(sum(pt.points_earned) filter (
        where pt.counts_for_ongoing
          and pt.approval_status = 'approved'
          and (p_days is null or pt.occurred_at >= now() - make_interval(days => p_days))
      ), 0)::integer as points,
      max(pt.occurred_at) filter (
        where pt.counts_for_ongoing
          and pt.approval_status = 'approved'
          and (p_days is null or pt.occurred_at >= now() - make_interval(days => p_days))
      ) as last_point_at,
      p.created_at
    from public.profiles p
    left join public.point_transactions pt
      on pt.user_id = p.id
    group by p.id, p.username, p.full_name, p.avatar_url, p.created_at
  ),
  ranked as (
    select
      scored.user_id,
      scored.username,
      scored.full_name,
      scored.avatar_url,
      scored.points,
      rank() over (order by scored.points desc, scored.created_at asc)::integer as rank,
      scored.last_point_at
    from scored
    where p_days is null or scored.points <> 0
  )
  select
    ranked.user_id,
    ranked.username,
    ranked.full_name,
    ranked.avatar_url,
    ranked.points,
    ranked.rank,
    ranked.last_point_at
  from ranked
  order by ranked.points desc, ranked.rank asc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

drop view if exists public.gpe_camp_leaderboard;

create view public.gpe_camp_leaderboard
as
select
  sm.season_id,
  s.slug as season_slug,
  sm.id as season_member_id,
  sm.user_id,
  sm.contact_email,
  sm.neon_account_id,
  sm.cabin_id,
  c.name as cabin_name,
  p.username,
  p.full_name,
  p.avatar_url,
  coalesce(sum(pt.points_earned) filter (
    where pt.counts_for_season
      and pt.approval_status = 'approved'
  ), 0)::integer as points,
  count(distinct pt.source_id) filter (
    where pt.counts_for_season
      and pt.approval_status = 'approved'
      and pt.challenge_id is not null
      and pt.source_id is not null
  )::integer as approved_challenge_count,
  rank() over (
    partition by sm.season_id
    order by coalesce(sum(pt.points_earned) filter (
      where pt.counts_for_season
        and pt.approval_status = 'approved'
    ), 0) desc, sm.joined_at asc
  )::integer as rank,
  now() as updated_at
from public.gpe_season_members sm
join public.gpe_seasons s
  on s.id = sm.season_id
left join public.gpe_cabins c
  on c.id = sm.cabin_id
left join public.profiles p
  on p.id = sm.user_id
left join public.point_transactions pt
  on pt.season_id = sm.season_id
 and (
   pt.season_member_id = sm.id
   or (pt.season_member_id is null and pt.user_id = sm.user_id)
 )
where sm.status in ('registered', 'active')
group by
  sm.season_id,
  s.slug,
  sm.id,
  sm.user_id,
  sm.contact_email,
  sm.neon_account_id,
  sm.cabin_id,
  c.name,
  p.username,
  p.full_name,
  p.avatar_url,
  sm.joined_at;

create or replace view public.gpe_camp_cabin_leaderboard
as
with cabin_members as (
  select
    sm.season_id,
    sm.cabin_id,
    count(distinct sm.id)::integer as member_count
  from public.gpe_season_members sm
  where sm.status in ('registered', 'active')
    and sm.cabin_id is not null
  group by sm.season_id, sm.cabin_id
)
select
  s.id as season_id,
  c.id as cabin_id,
  c.name as cabin_name,
  coalesce(sum(pt.points_earned) filter (
    where pt.counts_for_cabin
      and pt.approval_status = 'approved'
      and pt.cabin_id = c.id
      and pt.season_id = s.id
  ), 0)::integer as points,
  coalesce(max(cm.member_count), 0)::integer as member_count,
  rank() over (
    partition by s.id
    order by coalesce(sum(pt.points_earned) filter (
      where pt.counts_for_cabin
        and pt.approval_status = 'approved'
        and pt.cabin_id = c.id
        and pt.season_id = s.id
    ), 0) desc, min(c.display_order) asc
  )::integer as rank,
  now() as updated_at
from public.gpe_seasons s
join public.gpe_cabins c
  on c.season_id = s.id
left join cabin_members cm
  on cm.season_id = s.id
 and cm.cabin_id = c.id
left join public.point_transactions pt
  on pt.season_id = s.id
 and pt.cabin_id = c.id
 and pt.counts_for_cabin
 and pt.approval_status = 'approved'
group by s.id, c.id, c.name;

create or replace view public.gpe_camp_recent_activity
as
select
  pt.id,
  pt.season_id,
  pt.season_member_id,
  pt.user_id,
  pt.challenge_id,
  pt.points_earned as points,
  coalesce(pt.action_type, pt.source, 'camp_action') as reason,
  coalesce(pt.source, 'point_transaction') as source,
  pt.source_id,
  pt.metadata,
  pt.occurred_at,
  pt.created_at,
  p.username,
  p.full_name,
  p.avatar_url,
  ch.title as challenge_title,
  ch.category as challenge_category
from public.point_transactions pt
left join public.profiles p
  on p.id = pt.user_id
left join public.gpe_challenges ch
  on ch.id = pt.challenge_id
where pt.counts_for_season
  and pt.approval_status = 'approved';

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
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to award reviewed Hub points.';
  end if;
  if p_user_id is null then
    raise exception 'Point award requires a Hub profile.';
  end if;
  if p_points = 0 then
    return null;
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

create or replace function public.award_reviewed_hub_points(
  p_user_id uuid,
  p_points integer,
  p_source text,
  p_source_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.award_scoped_hub_points(
    p_user_id,
    p_points,
    p_source,
    p_source_id,
    p_metadata,
    p_source,
    null,
    null,
    null,
    null,
    true,
    false,
    false,
    'approved',
    now()
  );
end;
$$;

create or replace function public.approve_camp_submission_action(
  p_action_id uuid,
  p_points integer default null,
  p_notes text default null
)
returns table (
  ledger_id uuid,
  season_member_id uuid,
  season_points integer,
  season_rank integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.gpe_camp_submission_actions%rowtype;
  submission_row public.gpe_camp_challenge_submissions%rowtype;
  challenge_row public.gpe_challenges%rowtype;
  member_row public.gpe_season_members%rowtype;
  reviewer uuid := auth.uid();
  points_to_award integer;
  general_transaction_id uuid;
  cabin_counts boolean;
begin
  if reviewer is null or not public.can_manage_camp(reviewer) then
    raise exception 'Not authorized to review Camp submissions.';
  end if;

  select * into action_row from public.gpe_camp_submission_actions where id = p_action_id for update;
  if not found then
    raise exception 'Submission action not found.';
  end if;
  if action_row.review_status = 'approved' then
    raise exception 'Submission action is already approved.';
  end if;

  select * into submission_row from public.gpe_camp_challenge_submissions where id = action_row.submission_id for update;
  if submission_row.season_member_id is null then
    raise exception 'Submission is not linked to a Camp season member.';
  end if;

  select * into member_row
  from public.gpe_season_members
  where id = submission_row.season_member_id
  for update;

  if action_row.challenge_id is not null then
    select * into challenge_row from public.gpe_challenges where id = action_row.challenge_id;
  end if;

  points_to_award := coalesce(p_points, action_row.requested_points, challenge_row.point_value, 0);
  if points_to_award < 0 then
    raise exception 'Points cannot be negative.';
  end if;
  cabin_counts := member_row.cabin_id is not null;

  if submission_row.user_id is not null and points_to_award > 0 then
    general_transaction_id := public.award_scoped_hub_points(
      submission_row.user_id,
      points_to_award,
      'camp_submission_action_approval',
      p_action_id,
      jsonb_build_object(
        'season_id', submission_row.season_id,
        'season_member_id', submission_row.season_member_id,
        'submission_id', submission_row.id,
        'challenge_id', action_row.challenge_id,
        'reviewer_notes', p_notes
      ),
      coalesce(challenge_row.slug, action_row.other_description, 'camp_submission_action'),
      submission_row.season_id,
      action_row.challenge_id,
      submission_row.season_member_id,
      member_row.cabin_id,
      true,
      true,
      cabin_counts,
      'approved',
      now()
    );
  end if;

  update public.gpe_camp_submission_actions
  set
    review_status = 'approved',
    approved_points = points_to_award,
    reviewer_notes = p_notes,
    reviewed_by = reviewer,
    reviewed_at = now()
  where id = p_action_id;

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
    metadata,
    general_point_transaction_id,
    counts_for_ongoing,
    counts_for_season,
    counts_for_cabin,
    cabin_id_at_award,
    approval_status,
    occurred_at
  )
  values (
    submission_row.season_id,
    submission_row.season_member_id,
    submission_row.user_id,
    submission_row.id,
    action_row.id,
    action_row.challenge_id,
    points_to_award,
    coalesce(challenge_row.title, action_row.other_description, 'Camp GPE challenge'),
    'award',
    'challenge_award',
    'team_gpe_review',
    reviewer,
    reviewer,
    jsonb_build_object('reviewer_notes', p_notes, 'general_point_transaction_id', general_transaction_id),
    general_transaction_id,
    true,
    true,
    cabin_counts,
    member_row.cabin_id,
    'approved',
    now()
  )
  returning id into ledger_id;

  perform public.emit_gpe_notification('challenge_approved', submission_row.user_id, submission_row.season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));
  perform public.emit_gpe_notification('points_awarded', submission_row.user_id, submission_row.season_member_id, submission_row.season_id, submission_row.id, action_row.id, jsonb_build_object('points', points_to_award));

  select lb.points, lb.rank into season_points, season_rank
  from public.gpe_camp_leaderboard lb
  where lb.season_member_id = submission_row.season_member_id;

  season_member_id := submission_row.season_member_id;
  return next;
end;
$$;

create or replace function public.add_manual_camp_point_entry(
  p_season_id uuid,
  p_season_member_id uuid,
  p_points integer,
  p_reason text
)
returns table (
  ledger_id uuid,
  season_member_id uuid,
  season_points integer,
  season_rank integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  member_row public.gpe_season_members%rowtype;
  general_transaction_id uuid;
  cabin_counts boolean;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to manage Camp points.';
  end if;
  if p_points = 0 then
    raise exception 'Manual point adjustment cannot be zero.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Manual point adjustment requires a reason.';
  end if;

  select * into member_row
  from public.gpe_season_members
  where id = p_season_member_id
    and season_id = p_season_id
  for update;
  if not found then
    raise exception 'Camp season member not found.';
  end if;

  cabin_counts := member_row.cabin_id is not null;

  insert into public.gpe_camp_points_ledger (
    season_id,
    season_member_id,
    user_id,
    points,
    reason,
    adjustment_type,
    entry_type,
    source,
    created_by,
    awarded_by,
    metadata,
    counts_for_ongoing,
    counts_for_season,
    counts_for_cabin,
    cabin_id_at_award,
    approval_status,
    occurred_at
  )
  values (
    p_season_id,
    p_season_member_id,
    member_row.user_id,
    p_points,
    p_reason,
    'manual',
    case when p_points >= 0 then 'manual_adjustment'::public.gpe_point_entry_type else 'penalty'::public.gpe_point_entry_type end,
    'team_gpe_review',
    actor,
    actor,
    jsonb_build_object('manual_adjustment', true),
    true,
    true,
    cabin_counts,
    member_row.cabin_id,
    'approved',
    now()
  )
  returning id into ledger_id;

  if member_row.user_id is not null then
    general_transaction_id := public.award_scoped_hub_points(
      member_row.user_id,
      p_points,
      'camp_manual_point_entry',
      ledger_id,
      jsonb_build_object('season_id', p_season_id, 'season_member_id', p_season_member_id, 'reason', p_reason),
      'camp_manual_adjustment',
      p_season_id,
      null,
      p_season_member_id,
      member_row.cabin_id,
      true,
      true,
      cabin_counts,
      'approved',
      now()
    );

    update public.gpe_camp_points_ledger
    set general_point_transaction_id = general_transaction_id,
        metadata = metadata || jsonb_build_object('general_point_transaction_id', general_transaction_id)
    where id = ledger_id;
  end if;

  perform public.emit_gpe_notification(
    'points_awarded',
    member_row.user_id,
    p_season_member_id,
    p_season_id,
    null,
    null,
    jsonb_build_object('points', p_points, 'reason', p_reason, 'source', 'manual_adjustment')
  );

  select lb.points, lb.rank into season_points, season_rank
  from public.gpe_camp_leaderboard lb
  where lb.season_member_id = p_season_member_id;

  season_member_id := p_season_member_id;
  return next;
end;
$$;

create or replace function public.approve_event_participation_claim(
  p_claim_id uuid,
  p_points integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  claim_row public.gpe_event_participation_claims%rowtype;
  event_row public.gpe_event_cache%rowtype;
  resolved_user_id uuid;
  member_row public.gpe_season_members%rowtype;
  points_to_award integer;
  transaction_id uuid;
  season_counts boolean := false;
  cabin_counts boolean := false;
begin
  if actor is null or not public.can_manage_camp(actor) then
    raise exception 'Not authorized to review event participation claims.';
  end if;

  select * into claim_row
  from public.gpe_event_participation_claims
  where id = p_claim_id
  for update;
  if not found then
    raise exception 'Event participation claim not found.';
  end if;
  if claim_row.claim_status = 'awarded' then
    return jsonb_build_object('claim_id', claim_row.id, 'point_transaction_id', claim_row.point_transaction_id, 'status', 'awarded');
  end if;

  select * into event_row
  from public.gpe_event_cache
  where id = claim_row.event_id
     or neon_event_id = claim_row.neon_event_id
  order by case when id = claim_row.event_id then 1 else 2 end
  limit 1;

  select p.id into resolved_user_id
  from public.profiles p
  where p.id = claim_row.hub_user_id
     or (claim_row.neon_account_id is not null and p.neon_account_id = claim_row.neon_account_id)
     or lower(coalesce(p.email, '')) = claim_row.email_normalized
  order by case
    when p.id = claim_row.hub_user_id then 1
    when claim_row.neon_account_id is not null and p.neon_account_id = claim_row.neon_account_id then 2
    else 3
  end
  limit 1;
  if resolved_user_id is null then
    update public.gpe_event_participation_claims
    set claim_status = 'manual_review',
        metadata = metadata || jsonb_build_object('review_notes', p_notes, 'manual_review_reason', 'No linked Hub profile'),
        reviewed_by = actor,
        reviewed_at = now()
    where id = p_claim_id;
    raise exception 'Event participation claim is not linked to a Hub profile.';
  end if;

  if event_row.season_id is not null then
    select * into member_row
    from public.gpe_season_members sm
    where sm.season_id = event_row.season_id
      and (
        sm.user_id = resolved_user_id
        or (claim_row.neon_account_id is not null and sm.neon_account_id = claim_row.neon_account_id)
        or sm.contact_email = claim_row.email_normalized
      )
    order by case when sm.user_id = resolved_user_id then 1 else 2 end
    limit 1;
  end if;

  season_counts := coalesce(event_row.counts_for_season, false) and event_row.season_id is not null;
  cabin_counts := season_counts and coalesce(event_row.counts_for_cabin, false) and member_row.cabin_id is not null;
  points_to_award := coalesce(p_points, claim_row.impact_points, event_row.impact_points, 0);
  if points_to_award < 0 then
    raise exception 'Event participation points cannot be negative.';
  end if;

  if points_to_award > 0 then
    transaction_id := public.award_scoped_hub_points(
      resolved_user_id,
      points_to_award,
      'event_participation_claim',
      p_claim_id,
      jsonb_build_object(
        'event_id', claim_row.event_id,
        'neon_event_id', claim_row.neon_event_id,
        'registration_intent_id', claim_row.registration_intent_id,
        'review_notes', p_notes
      ),
      'event_participation',
      case when season_counts then event_row.season_id else null end,
      case when season_counts then event_row.challenge_id else null end,
      case when season_counts then member_row.id else null end,
      case when cabin_counts then member_row.cabin_id else null end,
      coalesce(event_row.counts_for_ongoing, true),
      season_counts,
      cabin_counts,
      'approved',
      now()
    );
  end if;

  update public.gpe_event_participation_claims
  set hub_user_id = resolved_user_id,
      claim_status = 'awarded',
      impact_points = points_to_award,
      point_transaction_id = transaction_id,
      reviewed_by = actor,
      reviewed_at = now(),
      metadata = metadata || jsonb_build_object(
        'review_notes', p_notes,
        'counts_for_ongoing', coalesce(event_row.counts_for_ongoing, true),
        'counts_for_season', season_counts,
        'counts_for_cabin', cabin_counts
      )
  where id = p_claim_id;

  perform public.emit_gpe_event_notification(
    'event_points_awarded',
    resolved_user_id,
    claim_row.event_id,
    claim_row.registration_intent_id,
    jsonb_build_object('points', points_to_award, 'claim_id', p_claim_id)
  );

  return jsonb_build_object(
    'claim_id', p_claim_id,
    'point_transaction_id', transaction_id,
    'status', 'awarded',
    'points', points_to_award,
    'counts_for_ongoing', coalesce(event_row.counts_for_ongoing, true),
    'counts_for_season', season_counts,
    'counts_for_cabin', cabin_counts
  );
end;
$$;

grant select on public.gpe_ongoing_member_leaderboard to authenticated;
grant select on public.gpe_camp_leaderboard to authenticated;
grant select on public.gpe_camp_cabin_leaderboard to authenticated;
grant select on public.gpe_camp_recent_activity to authenticated;

grant execute on function public.award_scoped_hub_points(uuid, integer, text, uuid, jsonb, text, uuid, uuid, uuid, uuid, boolean, boolean, boolean, text, timestamptz) to authenticated;
grant execute on function public.award_reviewed_hub_points(uuid, integer, text, uuid, jsonb) to authenticated;
grant execute on function public.approve_camp_submission_action(uuid, integer, text) to authenticated;
grant execute on function public.add_manual_camp_point_entry(uuid, uuid, integer, text) to authenticated;
grant execute on function public.approve_event_participation_claim(uuid, integer, text) to authenticated;
grant execute on function public.get_ongoing_member_leaderboard(integer, integer) to authenticated;
