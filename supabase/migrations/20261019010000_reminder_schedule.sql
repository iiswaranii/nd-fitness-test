-- Run the reminder job every 5 minutes. No hand-typed secrets: the job's secret is generated here and kept
-- in app_keys (server-only); the function compares it. The anon key only gets the request past the gateway.
create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into public.app_keys (name, value)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- The project's public anon key (the same one the app ships with), so the job can pass the function gateway.
insert into public.app_keys (name, value)
values ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1bm54cXNwbmhsd3ZsbnV5cGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDk4MDIsImV4cCI6MjEwNzg4NTgwMn0.O_q27lwSMY1xHWeuJHAUJa37MlKTGtm_W2sHpVCaNjc')
on conflict (name) do update set value = excluded.value;

select cron.unschedule(jobid) from cron.job where jobname = 'send-reminders';
select cron.schedule('send-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://bunnxqspnhlwvlnuypdo.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_keys where name = 'anon_key'),
      'x-cron-secret', (select value from public.app_keys where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
