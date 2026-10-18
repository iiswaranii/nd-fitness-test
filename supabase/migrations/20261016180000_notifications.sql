-- Phone notifications (free Web Push): device subscriptions, preferences and reminder times.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  tz          text not null default 'Asia/Kolkata',   -- the phone's time zone, so reminders arrive at local time
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push: own" on public.push_subscriptions;
create policy "push: own" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.profiles add column if not exists notify_new_challenges boolean not null default true;
grant update (full_name, city, state, country, password_set, notify_new_challenges) on public.profiles to authenticated;

alter table public.challenge_members
  add column if not exists reminder_time time,          -- local time of day, null = no reminder
  add column if not exists last_reminded date;          -- written by the reminder job only

-- ---------- run the reminder job every 15 minutes (pg_cron + pg_net, both free on Supabase) ----------
-- 1. Database → Extensions: enable pg_cron and pg_net.
-- 2. Store the project URL and a secret the function checks (set the same CRON_SECRET with `supabase secrets set`):
--      select vault.create_secret('https://YOUR-REF.supabase.co', 'project_url');
--      select vault.create_secret('a-long-random-string', 'cron_secret');
-- 3. Schedule it:
--      select cron.schedule('send-reminders', '*/15 * * * *', $$
--        select net.http_post(
--          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
--          headers := jsonb_build_object('Content-Type', 'application/json',
--                       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
--          body := '{}'::jsonb);
--      $$);
