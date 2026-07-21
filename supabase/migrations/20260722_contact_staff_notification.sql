do $$
begin
  if not exists (select 1 from pg_type where typname = 'gpe_form_notification_status') then
    create type public.gpe_form_notification_status as enum (
      'not_sent',
      'sent',
      'failed',
      'retry_pending'
    );
  end if;
end
$$;

alter table public.gpe_form_submissions
add column if not exists staff_notification_status public.gpe_form_notification_status not null default 'not_sent',
add column if not exists staff_notification_provider text,
add column if not exists staff_notification_message_id text,
add column if not exists staff_notification_sent_at timestamptz,
add column if not exists staff_notification_last_error text,
add column if not exists staff_notification_retry_count integer not null default 0;

create index if not exists gpe_form_submissions_staff_notification_idx
on public.gpe_form_submissions (staff_notification_status, created_at desc);
