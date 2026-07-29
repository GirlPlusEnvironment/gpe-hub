create table if not exists public.membership_lookup_cache (
  normalized_email text primary key,
  outcome text not null,
  public_state text not null,
  matched boolean not null default false,
  is_active_member boolean not null default false,
  neon_account_id text,
  membership_status text,
  membership_level text,
  membership_start_at date,
  membership_end_at date,
  hub_access text not null default 'membership_required',
  hub_user_linked boolean not null default false,
  requires_manual_review boolean not null default false,
  source text not null default 'neon_lookup',
  last_verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_lookup_cache_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists membership_lookup_cache_expires_idx
  on public.membership_lookup_cache (expires_at);

drop trigger if exists update_membership_lookup_cache_updated_at on public.membership_lookup_cache;
create trigger update_membership_lookup_cache_updated_at
before update on public.membership_lookup_cache
for each row execute function public.update_updated_at_column();

alter table public.membership_lookup_cache enable row level security;

revoke all on public.membership_lookup_cache from anon, authenticated;
grant select, insert, update, delete on public.membership_lookup_cache to service_role;
