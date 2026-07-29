alter table public.hub_invitations
  add column if not exists source text,
  add column if not exists source_id uuid;

create index if not exists hub_invitations_source_idx
  on public.hub_invitations (source, source_id)
  where source is not null and source_id is not null;

update public.hub_invitations
set
  source = coalesce(source, 'neon_climate_survey'),
  source_id = coalesce(source_id, submission_id)
where submission_id is not null;
