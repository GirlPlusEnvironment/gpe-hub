alter table public.neon_climate_survey_submissions
  add column if not exists neon_membership_id text,
  add column if not exists membership_creation_status text not null default 'not_requested',
  add column if not exists membership_email_queued boolean not null default false,
  add column if not exists hub_invite_queued boolean not null default false,
  add column if not exists membership_status_detail jsonb not null default '{}'::jsonb;

create index if not exists neon_climate_submissions_membership_id_idx
  on public.neon_climate_survey_submissions (neon_membership_id)
  where neon_membership_id is not null;
