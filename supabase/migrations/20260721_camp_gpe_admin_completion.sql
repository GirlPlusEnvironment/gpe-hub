create table if not exists public.gpe_camp_submission_members (
  id uuid primary key default gen_random_uuid(),
  submission_action_id uuid not null references public.gpe_camp_submission_actions(id) on delete cascade,
  season_member_id uuid not null references public.gpe_season_members(id) on delete cascade,
  attribution_mode text not null default 'full',
  points_share numeric(5,2),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gpe_camp_submission_members_unique unique (submission_action_id, season_member_id),
  constraint gpe_camp_submission_members_attribution check (attribution_mode in ('full', 'split', 'primary', 'none')),
  constraint gpe_camp_submission_members_points_share check (points_share is null or points_share >= 0)
);

alter table public.gpe_camp_submission_members enable row level security;

create policy "gpe_camp_submission_members_read_own_or_team"
on public.gpe_camp_submission_members
for select
to authenticated
using (
  public.can_manage_camp(auth.uid())
  or exists (
    select 1
    from public.gpe_season_members sm
    where sm.id = season_member_id
      and sm.user_id = auth.uid()
  )
);

create policy "gpe_camp_submission_members_manage_team"
on public.gpe_camp_submission_members
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

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
    metadata
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
    jsonb_build_object('manual_adjustment', true)
  )
  returning id into ledger_id;

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
