create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (
    select 1
    from vault.decrypted_secrets
    where name in ('gpe_project_url', 'gpe_email_service_secret')
    group by 1
    having count(*) >= 2
  ) then
    perform cron.unschedule('hub-membership-grace-period-daily');
  end if;
exception
  when others then
    null;
end
$$;

do $$
begin
  if exists (
    select 1
    from vault.decrypted_secrets
    where name = 'gpe_project_url'
  ) and exists (
    select 1
    from vault.decrypted_secrets
    where name = 'gpe_email_service_secret'
  ) then
    perform cron.schedule(
      'hub-membership-grace-period-daily',
      '17 9 * * *',
      $cron$
        select
          net.http_post(
            url := (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'gpe_project_url'
              limit 1
            ) || '/functions/v1/hub-membership-grace-period',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || (
                select decrypted_secret
                from vault.decrypted_secrets
                where name = 'gpe_email_service_secret'
                limit 1
              )
            ),
            body := jsonb_build_object(
              'source', 'supabase_cron',
              'ranAt', now()
            )
          ) as request_id;
      $cron$
    );
  end if;
end
$$;
