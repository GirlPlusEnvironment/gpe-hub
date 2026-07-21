do $$
begin
  if not exists (select 1 from pg_type where typname = 'gpe_user_role') then
    create type public.gpe_user_role as enum ('member', 'team_gpe', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'gpe_season_status') then
    create type public.gpe_season_status as enum ('draft', 'active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'gpe_season_member_status') then
    create type public.gpe_season_member_status as enum ('registered', 'active', 'inactive', 'withdrawn');
  end if;

  if not exists (select 1 from pg_type where typname = 'gpe_camp_review_status') then
    create type public.gpe_camp_review_status as enum ('pending', 'approved', 'rejected', 'needs_info');
  end if;

  if not exists (select 1 from pg_type where typname = 'gpe_camp_adjustment_type') then
    create type public.gpe_camp_adjustment_type as enum ('award', 'correction', 'manual', 'reversal');
  end if;
end
$$;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists neon_account_id text;
alter table public.profiles add column if not exists member_status text;

create unique index if not exists profiles_email_unique_idx
on public.profiles (lower(email))
where email is not null;

create index if not exists profiles_neon_account_id_idx
on public.profiles (neon_account_id)
where neon_account_id is not null;

update public.profiles as profiles
set
  email = lower(users.email),
  first_name = coalesce(profiles.first_name, nullif(trim(users.raw_user_meta_data ->> 'first_name'), '')),
  last_name = coalesce(profiles.last_name, nullif(trim(users.raw_user_meta_data ->> 'last_name'), '')),
  updated_at = now()
from auth.users as users
where profiles.id = users.id
  and (
    profiles.email is distinct from lower(users.email)
    or profiles.first_name is null
    or profiles.last_name is null
  );

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
begin
  normalized_username := nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '');

  insert into public.profiles (
    id,
    email,
    username,
    full_name,
    first_name,
    last_name,
    avatar_url,
    bio,
    points
  )
  values (
    new.id,
    lower(new.email),
    normalized_username,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''),
    new.raw_user_meta_data ->> 'avatar_url',
    null,
    0
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    username = coalesce(public.profiles.username, excluded.username),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.gpe_user_role not null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role, granted_at)
);

create table if not exists public.gpe_seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.gpe_season_status not null default 'draft',
  is_visible boolean not null default false,
  point_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_seasons_point_rules_object check (jsonb_typeof(point_rules) = 'object')
);

create table if not exists public.gpe_cabins (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.gpe_seasons(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_cabins_unique_name unique (season_id, name)
);

create table if not exists public.gpe_season_members (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.gpe_seasons(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  neon_account_id text,
  contact_email text not null,
  cabin_id uuid references public.gpe_cabins(id) on delete set null,
  joined_at timestamptz not null default now(),
  status public.gpe_season_member_status not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_season_members_email_lower check (contact_email = lower(contact_email)),
  constraint gpe_season_members_unique_email unique (season_id, contact_email),
  constraint gpe_season_members_unique_user unique (season_id, user_id)
);

create table if not exists public.gpe_camp_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  form_submission_id uuid references public.gpe_form_submissions(id) on delete set null,
  season_id uuid not null references public.gpe_seasons(id) on delete cascade,
  season_member_id uuid references public.gpe_season_members(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  neon_account_id text,
  contact_email text not null,
  challenge_key text not null,
  submitted_payload jsonb not null default '{}'::jsonb,
  proof_links jsonb not null default '[]'::jsonb,
  review_status public.gpe_camp_review_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_camp_submissions_email_lower check (contact_email = lower(contact_email)),
  constraint gpe_camp_submissions_payload_object check (jsonb_typeof(submitted_payload) = 'object'),
  constraint gpe_camp_submissions_proof_array check (jsonb_typeof(proof_links) = 'array')
);

create table if not exists public.gpe_camp_points_ledger (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.gpe_seasons(id) on delete cascade,
  season_member_id uuid not null references public.gpe_season_members(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  submission_id uuid references public.gpe_camp_challenge_submissions(id) on delete set null,
  points integer not null,
  reason text not null,
  adjustment_type public.gpe_camp_adjustment_type not null default 'award',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reversed_by uuid references public.profiles(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text
);

create index if not exists user_roles_active_role_idx on public.user_roles (role, user_id) where revoked_at is null;
create index if not exists gpe_seasons_status_visible_idx on public.gpe_seasons (status, is_visible);
create index if not exists gpe_cabins_season_order_idx on public.gpe_cabins (season_id, display_order);
create index if not exists gpe_season_members_season_status_idx on public.gpe_season_members (season_id, status);
create index if not exists gpe_season_members_email_idx on public.gpe_season_members (contact_email);
create index if not exists gpe_camp_submissions_review_idx on public.gpe_camp_challenge_submissions (season_id, review_status, created_at desc);
create index if not exists gpe_camp_submissions_email_idx on public.gpe_camp_challenge_submissions (contact_email);
create index if not exists gpe_camp_points_ledger_member_idx on public.gpe_camp_points_ledger (season_member_id, created_at desc);
create index if not exists gpe_camp_points_ledger_season_idx on public.gpe_camp_points_ledger (season_id, created_at desc);

drop trigger if exists update_gpe_seasons_updated_at on public.gpe_seasons;
create trigger update_gpe_seasons_updated_at
before update on public.gpe_seasons
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gpe_cabins_updated_at on public.gpe_cabins;
create trigger update_gpe_cabins_updated_at
before update on public.gpe_cabins
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gpe_season_members_updated_at on public.gpe_season_members;
create trigger update_gpe_season_members_updated_at
before update on public.gpe_season_members
for each row execute function public.update_updated_at_column();

drop trigger if exists update_gpe_camp_challenge_submissions_updated_at on public.gpe_camp_challenge_submissions;
create trigger update_gpe_camp_challenge_submissions_updated_at
before update on public.gpe_camp_challenge_submissions
for each row execute function public.update_updated_at_column();

create or replace function public.has_role(check_user_id uuid, check_role public.gpe_user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = check_user_id
      and role = check_role
      and revoked_at is null
  );
$$;

create or replace function public.can_manage_camp(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(check_user_id, 'team_gpe'::public.gpe_user_role)
      or public.has_role(check_user_id, 'admin'::public.gpe_user_role)
      or exists (
        select 1
        from public.profiles
        where id = check_user_id
          and role = 'admin'
      );
$$;

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(check_user_id, 'admin'::public.gpe_user_role)
      or exists (
        select 1
        from public.profiles
        where id = check_user_id
          and role = 'admin'
      );
$$;

create or replace function public.active_camp_season()
returns public.gpe_seasons
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.gpe_seasons
  where slug = coalesce(current_setting('app.active_camp_season_slug', true), 'camp-gpe-2026')
  limit 1;
$$;

create or replace view public.gpe_camp_leaderboard as
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
  coalesce(sum(case when ledger.reversed_at is null then ledger.points else 0 end), 0)::integer as points,
  rank() over (
    partition by sm.season_id
    order by coalesce(sum(case when ledger.reversed_at is null then ledger.points else 0 end), 0) desc, sm.joined_at asc
  )::integer as rank
from public.gpe_season_members sm
join public.gpe_seasons s on s.id = sm.season_id
left join public.gpe_cabins c on c.id = sm.cabin_id
left join public.profiles p on p.id = sm.user_id
left join public.gpe_camp_points_ledger ledger on ledger.season_member_id = sm.id
where sm.status in ('registered', 'active')
group by sm.season_id, s.slug, sm.id, sm.user_id, sm.contact_email, sm.neon_account_id, sm.cabin_id, c.name, p.username, p.full_name, p.avatar_url, sm.joined_at;

alter table public.user_roles enable row level security;
alter table public.gpe_seasons enable row level security;
alter table public.gpe_cabins enable row level security;
alter table public.gpe_season_members enable row level security;
alter table public.gpe_camp_challenge_submissions enable row level security;
alter table public.gpe_camp_points_ledger enable row level security;

create policy "user_roles_read_own_or_admin"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "user_roles_admin_insert"
on public.user_roles
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "user_roles_admin_update"
on public.user_roles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "gpe_seasons_read_visible"
on public.gpe_seasons
for select
to authenticated
using (is_visible or public.can_manage_camp(auth.uid()));

create policy "gpe_seasons_manage_team"
on public.gpe_seasons
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

create policy "gpe_cabins_read_visible_season"
on public.gpe_cabins
for select
to authenticated
using (
  exists (
    select 1 from public.gpe_seasons s
    where s.id = season_id
      and (s.is_visible or public.can_manage_camp(auth.uid()))
  )
);

create policy "gpe_cabins_manage_team"
on public.gpe_cabins
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

create policy "gpe_season_members_read_own_or_team"
on public.gpe_season_members
for select
to authenticated
using (user_id = auth.uid() or public.can_manage_camp(auth.uid()));

create policy "gpe_season_members_manage_team"
on public.gpe_season_members
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

create policy "gpe_camp_submissions_read_own_or_team"
on public.gpe_camp_challenge_submissions
for select
to authenticated
using (user_id = auth.uid() or public.can_manage_camp(auth.uid()));

create policy "gpe_camp_submissions_manage_team"
on public.gpe_camp_challenge_submissions
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

create policy "gpe_camp_points_read_own_or_team"
on public.gpe_camp_points_ledger
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

create policy "gpe_camp_points_manage_team"
on public.gpe_camp_points_ledger
for all
to authenticated
using (public.can_manage_camp(auth.uid()))
with check (public.can_manage_camp(auth.uid()));

insert into public.gpe_seasons (slug, name, description, status, is_visible, point_rules)
values (
  'camp-gpe-2026',
  'Camp GPE Summer 2026',
  'Seasonal Camp GPE challenge and leaderboard program.',
  'active',
  true,
  '{"challenge_review_required": true}'::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  description = coalesce(public.gpe_seasons.description, excluded.description),
  status = excluded.status,
  is_visible = excluded.is_visible,
  updated_at = now();
