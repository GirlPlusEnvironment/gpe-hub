alter table public.gpe_seasons
  add column if not exists metadata jsonb not null default '{}'::jsonb;
