alter table public.gpe_notification_outbox
  add column if not exists template_key text,
  add column if not exists template_version integer,
  add column if not exists recipient_email text,
  add column if not exists recipient_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists neon_account_id text,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists subject text,
  add column if not exists variables jsonb not null default '{}'::jsonb,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists queued_at timestamptz not null default now(),
  add column if not exists sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complaint_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0;

create unique index if not exists gpe_notification_outbox_idempotency_unique
  on public.gpe_notification_outbox (idempotency_key)
  where idempotency_key is not null;

create index if not exists gpe_notification_outbox_email_template_idx
  on public.gpe_notification_outbox (template_key, recipient_email, queued_at desc)
  where template_key is not null;

create table if not exists public.gpe_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  template_version integer not null default 1,
  recipient_email text not null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  neon_account_id text,
  event_type text,
  source_type text,
  source_id uuid,
  idempotency_key text not null,
  subject text not null,
  variables jsonb not null default '{}'::jsonb,
  provider text not null default 'resend',
  provider_message_id text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complaint_at timestamptz,
  failed_at timestamptz,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpe_email_deliveries_email_lower check (recipient_email = lower(recipient_email)),
  constraint gpe_email_deliveries_variables_object check (jsonb_typeof(variables) = 'object'),
  constraint gpe_email_deliveries_idempotency_unique unique (idempotency_key)
);

create index if not exists gpe_email_deliveries_recipient_idx
  on public.gpe_email_deliveries (recipient_email, created_at desc);

create index if not exists gpe_email_deliveries_template_status_idx
  on public.gpe_email_deliveries (template_key, sent_at, failed_at, queued_at desc);

drop trigger if exists update_gpe_email_deliveries_updated_at on public.gpe_email_deliveries;
create trigger update_gpe_email_deliveries_updated_at
before update on public.gpe_email_deliveries
for each row execute function public.update_updated_at_column();

create table if not exists public.gpe_email_preferences (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  category text not null,
  opted_in boolean not null default true,
  source text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint gpe_email_preferences_email_lower check (recipient_email = lower(recipient_email)),
  constraint gpe_email_preferences_unique unique (recipient_email, category)
);

create index if not exists gpe_email_preferences_user_idx
  on public.gpe_email_preferences (user_id, category)
  where user_id is not null;

create table if not exists public.gpe_email_suppressions (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  reason text not null,
  provider text,
  provider_event_id text,
  suppressed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint gpe_email_suppressions_email_lower check (recipient_email = lower(recipient_email)),
  constraint gpe_email_suppressions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint gpe_email_suppressions_unique unique (recipient_email, reason)
);

alter table public.gpe_email_deliveries enable row level security;
alter table public.gpe_email_preferences enable row level security;
alter table public.gpe_email_suppressions enable row level security;

grant select, insert, update on public.gpe_email_deliveries to service_role;
grant select, insert, update on public.gpe_email_preferences to service_role;
grant select, insert, update on public.gpe_email_suppressions to service_role;
grant select on public.gpe_email_deliveries to authenticated;
grant select, insert, update on public.gpe_email_preferences to authenticated;

drop policy if exists "gpe_email_deliveries_admin_read" on public.gpe_email_deliveries;
create policy "gpe_email_deliveries_admin_read"
on public.gpe_email_deliveries
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "gpe_email_preferences_own_or_admin" on public.gpe_email_preferences;
create policy "gpe_email_preferences_own_or_admin"
on public.gpe_email_preferences
for select
to authenticated
using ((select auth.uid()) = user_id or public.is_admin(auth.uid()));

drop policy if exists "gpe_email_preferences_update_own_or_admin" on public.gpe_email_preferences;
create policy "gpe_email_preferences_update_own_or_admin"
on public.gpe_email_preferences
for update
to authenticated
using ((select auth.uid()) = user_id or public.is_admin(auth.uid()))
with check ((select auth.uid()) = user_id or public.is_admin(auth.uid()));

drop policy if exists "gpe_email_suppressions_admin_read" on public.gpe_email_suppressions;
create policy "gpe_email_suppressions_admin_read"
on public.gpe_email_suppressions
for select
to authenticated
using (public.is_admin(auth.uid()));
