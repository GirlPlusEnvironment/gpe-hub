-- Treat routine Hub actions as automatic point events, while keeping Camp
-- challenge approvals in the human review workflow.

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
  ('hub_post', 'Create a discussion', 10, true, true, false, false, false, 1, 'daily_cap', '{"source":"member_action_rpc"}'::jsonb),
  ('hub_comment', 'Comment on a discussion', 2, true, true, false, false, false, 5, 'daily_cap', '{"source":"member_action_rpc"}'::jsonb),
  ('hub_post_like', 'Like a post', 1, true, true, false, false, false, null, 'source_once', '{"source":"member_action_rpc"}'::jsonb),
  ('hub_poll_vote', 'Vote in a poll', 1, true, true, false, false, false, null, 'source_once', '{"source":"member_action_rpc"}'::jsonb),
  ('hub_message', 'Send a member message', 1, true, true, false, false, false, 10, 'daily_cap', '{"source":"member_action_rpc"}'::jsonb),
  ('listing_favorite', 'Favorite a listing', 1, true, true, false, false, false, null, 'source_once', '{"source":"member_action_rpc"}'::jsonb)
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

create or replace function public.profile_has_active_membership(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and (
        coalesce(p.membership_access_state, p.member_status) = 'active'
        or exists (
          select 1
          from public.membership_access ma
          where ma.user_id = p.id
            and ma.is_active
            and (ma.expires_at is null or ma.expires_at >= current_date)
        )
      )
  );
$$;

revoke all on function public.profile_has_active_membership(uuid) from public;
grant execute on function public.profile_has_active_membership(uuid) to authenticated;

create or replace function public.award_hub_action_points(
  p_action_type text,
  p_source text,
  p_source_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  rule_row public.hub_point_rules%rowtype;
  awards_today integer;
  transaction_id uuid;
begin
  if actor is null then
    raise exception 'Not authenticated.';
  end if;
  if p_source_id is null or nullif(trim(coalesce(p_source, '')), '') is null then
    raise exception 'Point event requires an idempotent source.';
  end if;
  if not public.profile_has_active_membership(actor) then
    return jsonb_build_object('ok', false, 'awarded', false, 'reason', 'inactive_membership');
  end if;

  select * into rule_row
  from public.hub_point_rules
  where action_type = p_action_type
    and active
    and not requires_approval
    and (effective_start is null or effective_start <= now())
    and (effective_end is null or effective_end >= now())
  limit 1;

  if not found or rule_row.point_value <= 0 then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'inactive_rule');
  end if;

  if exists (
    select 1
    from public.point_transactions pt
    where pt.user_id = actor
      and pt.action_type = rule_row.action_type
      and pt.source = p_source
      and pt.source_id = p_source_id
      and pt.points_earned > 0
  ) then
    return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'duplicate_source');
  end if;

  if rule_row.duplicate_strategy = 'daily_cap' and rule_row.max_awards_per_user is not null then
    select count(*)::integer into awards_today
    from public.point_transactions pt
    where pt.user_id = actor
      and pt.action_type = rule_row.action_type
      and pt.points_earned > 0
      and pt.occurred_at >= date_trunc('day', now());

    if awards_today >= rule_row.max_awards_per_user then
      return jsonb_build_object('ok', true, 'awarded', false, 'reason', 'daily_cap');
    end if;
  end if;

  insert into public.point_transactions (
    user_id,
    points_earned,
    source,
    source_id,
    metadata,
    action_type,
    counts_for_ongoing,
    counts_for_season,
    counts_for_cabin,
    approval_status,
    occurred_at,
    created_at
  )
  values (
    actor,
    rule_row.point_value,
    p_source,
    p_source_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('rule_action_type', rule_row.action_type),
    rule_row.action_type,
    rule_row.counts_for_ongoing,
    false,
    false,
    'approved',
    now(),
    now()
  )
  returning id into transaction_id;

  if rule_row.counts_for_ongoing then
    update public.profiles
    set points = greatest(0, points + rule_row.point_value),
        updated_at = now()
    where id = actor;
  end if;

  return jsonb_build_object(
    'ok', true,
    'awarded', transaction_id is not null,
    'transaction_id', transaction_id,
    'points', rule_row.point_value
  );
end;
$$;

revoke all on function public.award_hub_action_points(text, text, uuid, jsonb) from public;
grant execute on function public.award_hub_action_points(text, text, uuid, jsonb) to authenticated;

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
    where public.profile_has_active_membership(p.id)
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

drop view if exists public.gpe_camp_recent_activity;
drop view if exists public.gpe_camp_cabin_leaderboard;
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
join public.profiles p
  on p.id = sm.user_id
left join public.gpe_cabins c
  on c.id = sm.cabin_id
left join public.point_transactions pt
  on pt.season_id = sm.season_id
 and (
   pt.season_member_id = sm.id
   or (pt.season_member_id is null and pt.user_id = sm.user_id)
 )
where sm.status in ('registered', 'active')
  and public.profile_has_active_membership(p.id)
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

create view public.gpe_camp_cabin_leaderboard
as
with cabin_members as (
  select
    sm.season_id,
    sm.cabin_id,
    count(distinct sm.id)::integer as member_count
  from public.gpe_season_members sm
  join public.profiles p
    on p.id = sm.user_id
  where sm.status in ('registered', 'active')
    and sm.cabin_id is not null
    and public.profile_has_active_membership(p.id)
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
      and public.profile_has_active_membership(pt.user_id)
  ), 0)::integer as points,
  coalesce(max(cm.member_count), 0)::integer as member_count,
  rank() over (
    partition by s.id
    order by coalesce(sum(pt.points_earned) filter (
      where pt.counts_for_cabin
        and pt.approval_status = 'approved'
        and pt.cabin_id = c.id
        and pt.season_id = s.id
        and public.profile_has_active_membership(pt.user_id)
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

create view public.gpe_camp_recent_activity
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
join public.profiles p
  on p.id = pt.user_id
left join public.gpe_challenges ch
  on ch.id = pt.challenge_id
where pt.season_id is not null
  and pt.counts_for_season
  and pt.approval_status = 'approved'
  and public.profile_has_active_membership(pt.user_id);

grant select on public.gpe_camp_leaderboard to authenticated;
grant select on public.gpe_camp_cabin_leaderboard to authenticated;
grant select on public.gpe_camp_recent_activity to authenticated;
grant execute on function public.get_ongoing_member_leaderboard(integer, integer) to authenticated;
