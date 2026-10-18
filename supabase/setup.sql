-- Namdhari Health & Fitness — complete database setup (all migrations in order).
-- Paste into Supabase → SQL Editor → Run, on a new project. Starts empty: no sample data.
-- Source files: supabase/migrations/

-- ===================== 20261014000000_members_and_strava.sql =====================
-- Namdhari Health & Fitness — members and Strava connections.
-- Members only: there is no admin role in this phase.

create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  full_name            text,
  city                 text,
  email                text,
  phone                text,
  password_set         boolean not null default false,
  strava_connected     boolean not null default false,
  strava_athlete_id    bigint,
  strava_athlete_name  text,
  strava_connected_at  timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Members can read and edit only their own profile.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Members may only change these columns; Strava fields are written by the server.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, city, password_set) on public.profiles to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every new sign-up (Google, email or phone).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email/phone in the profile in step with the login record.
create or replace function public.handle_user_contact_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set email = new.email, phone = nullif(new.phone, '')
   where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_contact_change on auth.users;
create trigger on_auth_user_contact_change after update of email, phone on auth.users
  for each row execute function public.handle_user_contact_change();

-- Strava tokens. No client policies: only Edge Functions (service role) can read or write them.
create table if not exists public.strava_connections (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  athlete_id     bigint not null unique,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  scope          text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.strava_connections enable row level security;
revoke all on public.strava_connections from authenticated, anon;

drop trigger if exists strava_touch on public.strava_connections;
create trigger strava_touch before update on public.strava_connections
  for each row execute function public.touch_updated_at();

-- ===================== 20261016000000_challenges_habits_activities.sql =====================
-- Namdhari Health & Fitness — challenges (activity + healthy habit), habit logs, synced activities, admin role.

-- ---------- roles ----------
alter table public.profiles
  add column if not exists role text not null default 'member' check (role in ('member', 'admin')),
  add column if not exists strava_last_sync timestamptz;

-- Members still can't change their own role (column grants from the first migration stay limited).

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Admins can read every profile (for participant lists and exports).
drop policy if exists "profiles: admin read" on public.profiles;
create policy "profiles: admin read" on public.profiles
  for select to authenticated using (public.is_admin());

-- ---------- challenges ----------
create table if not exists public.challenges (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 3 and 60),
  description   text,
  category      text not null check (category in ('activity', 'habit')),
  sport         text check (sport in ('walk', 'run', 'ride')),
  metric        text check (metric in ('distance', 'days', 'count')),
  daily_min     numeric,              -- metric = days: km for a day to count
  min_km        numeric,              -- metric = count: km for an activity to count
  habit_key     text,                 -- key from the app's habit catalog
  daily_target  numeric,              -- habit: daily target (ml, minutes, minutes after midnight…)
  target        numeric not null check (target > 0),
  start_date    date not null,
  end_date      date not null,
  reg_opens     date not null,
  join_by       date not null,
  cancelled     boolean not null default false,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  check (end_date >= start_date),
  check (reg_opens <= join_by and join_by <= end_date),
  check (
    (category = 'activity' and sport is not null and metric is not null and habit_key is null)
    or (category = 'habit' and habit_key is not null and sport is null)
  )
);

alter table public.challenges enable row level security;

drop policy if exists "challenges: members read" on public.challenges;
create policy "challenges: members read" on public.challenges
  for select to authenticated using (true);

drop policy if exists "challenges: admin write" on public.challenges;
create policy "challenges: admin write" on public.challenges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- membership ----------
create table if not exists public.challenge_members (
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  daily_target  numeric,              -- optional personal daily km target (activity challenges)
  joined_at     timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenge_members enable row level security;

drop policy if exists "members: read own or admin" on public.challenge_members;
create policy "members: read own or admin" on public.challenge_members
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Joining is allowed only while registration is open.
drop policy if exists "members: join" on public.challenge_members;
create policy "members: join" on public.challenge_members
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.challenges c
       where c.id = challenge_id and not c.cancelled
         and current_date between c.reg_opens and c.join_by
    )
  );

drop policy if exists "members: update own" on public.challenge_members;
create policy "members: update own" on public.challenge_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members: leave" on public.challenge_members;
create policy "members: leave" on public.challenge_members
  for delete to authenticated using (user_id = auth.uid());

-- Everyone may see how many people joined (not who).
create or replace function public.challenge_member_counts()
returns table (challenge_id uuid, members int)
language sql stable security definer set search_path = public as $$
  select challenge_id, count(*)::int from public.challenge_members group by challenge_id;
$$;
grant execute on function public.challenge_member_counts() to authenticated;

-- ---------- habit logs ----------
create table if not exists public.habit_logs (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  day           date not null,
  value         numeric not null,
  entries       numeric[] not null default '{}',   -- individual adds (e.g. each glass of water)
  updated_at    timestamptz not null default now(),
  primary key (user_id, challenge_id, day)
);

alter table public.habit_logs enable row level security;

drop policy if exists "logs: read own or admin" on public.habit_logs;
create policy "logs: read own or admin" on public.habit_logs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Members log only for challenges they joined, only within the challenge dates, never in the future.
drop policy if exists "logs: write own" on public.habit_logs;
create policy "logs: write own" on public.habit_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and day <= current_date + 1   -- allow for time-zone edge
    and exists (
      select 1 from public.challenge_members m join public.challenges c on c.id = m.challenge_id
       where m.challenge_id = habit_logs.challenge_id and m.user_id = auth.uid()
         and habit_logs.day between c.start_date and c.end_date
    )
  );

drop trigger if exists habit_logs_touch on public.habit_logs;
create trigger habit_logs_touch before update on public.habit_logs
  for each row execute function public.touch_updated_at();

-- ---------- activities (from Strava; written only by Edge Functions) ----------
create table if not exists public.activities (
  id           bigint primary key,           -- Strava activity id
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sport        text not null check (sport in ('walk', 'run', 'ride')),
  name         text not null,
  start_utc    timestamptz not null,
  local_date   date not null,
  local_time   time not null,
  distance_m   numeric not null,
  moving_s     int not null,
  elapsed_s    int not null,
  elev_m       numeric,
  source       text not null default 'sync' check (source in ('sync', 'link')),
  synced_at    timestamptz not null default now()
);
create index if not exists activities_user_date on public.activities (user_id, local_date desc);

alter table public.activities enable row level security;

drop policy if exists "activities: read own or admin" on public.activities;
create policy "activities: read own or admin" on public.activities
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- No insert/update/delete policies: only the service role (Edge Functions) writes here.

-- When a member disconnects Strava, their Strava activities are removed too.
create or replace function public.purge_strava_activities() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.strava_connected and not new.strava_connected then
    delete from public.activities where user_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists profiles_purge_strava on public.profiles;
create trigger profiles_purge_strava after update of strava_connected on public.profiles
  for each row execute function public.purge_strava_activities();

-- ---------- make yourself admin ----------
-- Run once in the SQL editor, with your login email:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- ===================== 20261016120000_profiles_boards_insights.sql =====================
-- Location on profiles, private body measurements, leaderboards, admin insights, 4-day log editing window.

-- ---------- location (visible to admins for state/country insights) ----------
alter table public.profiles
  add column if not exists country text,
  add column if not exists state text;
grant update (full_name, city, state, country, password_set) on public.profiles to authenticated;

-- ---------- private health data: only the member can ever read or write it ----------
create table if not exists public.profile_health (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  height_cm   numeric check (height_cm between 90 and 250),
  weight_kg   numeric check (weight_kg between 20 and 300),
  updated_at  timestamptz not null default now()
);
alter table public.profile_health enable row level security;
drop policy if exists "health: own only" on public.profile_health;
create policy "health: own only" on public.profile_health
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Deliberately no admin policy.
drop trigger if exists health_touch on public.profile_health;
create trigger health_touch before update on public.profile_health
  for each row execute function public.touch_updated_at();

-- ---------- habit logs: members can add or correct the last 4 days only ----------
drop policy if exists "logs: write own" on public.habit_logs;
create policy "logs: write own" on public.habit_logs
  for all to authenticated
  using (user_id = auth.uid() and day >= current_date - 4)
  with check (
    user_id = auth.uid()
    and day between current_date - 4 and current_date + 1   -- +1 allows for time zones ahead of UTC
    and exists (
      select 1 from public.challenge_members m join public.challenges c on c.id = m.challenge_id
       where m.challenge_id = habit_logs.challenge_id and m.user_id = auth.uid()
         and habit_logs.day between c.start_date and c.end_date
    )
  );

-- ---------- leaderboard data for one challenge (members of it, and admins) ----------
create or replace function public.challenge_board(cid uuid)
returns table (user_id uuid, name text, city text, activities jsonb, logs jsonb)
language plpgsql stable security definer set search_path = public as $$
declare c public.challenges%rowtype;
begin
  select * into c from public.challenges where id = cid;
  if not found then return; end if;
  if not (public.is_admin() or exists (select 1 from public.challenge_members where challenge_id = cid and challenge_members.user_id = auth.uid())) then
    raise exception 'Join this challenge to see its leaderboard';
  end if;
  return query
  select m.user_id, coalesce(p.full_name, 'Member'), p.city,
    case when c.category = 'activity' then coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id::text, 'sport', a.sport, 'name', '', 'date', a.local_date, 'time', to_char(a.local_time, 'HH24:MI'),
             'km', a.distance_m / 1000.0, 'moving_s', 0, 'elapsed_s', 0, 'elev_m', null, 'source', 'sync'))
        from public.activities a
       where a.user_id = m.user_id and a.sport = c.sport and a.local_date between c.start_date and c.end_date), '[]'::jsonb)
    else '[]'::jsonb end,
    case when c.category = 'habit' then coalesce((
      select jsonb_agg(jsonb_build_object('challenge_id', l.challenge_id, 'date', l.day, 'value', l.value, 'entries', '[]'::jsonb))
        from public.habit_logs l where l.user_id = m.user_id and l.challenge_id = cid), '[]'::jsonb)
    else '[]'::jsonb end
  from public.challenge_members m join public.profiles p on p.id = m.user_id
  where m.challenge_id = cid;
end $$;
grant execute on function public.challenge_board(uuid) to authenticated;

-- ---------- admin insights: one row per member ----------
create or replace function public.admin_member_stats()
returns table (user_id uuid, name text, city text, state text, country text, joined_at timestamptz, strava_connected boolean,
               challenges int, live_challenges int, last_active date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, coalesce(p.full_name, 'Member'), p.city, p.state, p.country, p.created_at, p.strava_connected,
    (select count(*)::int from public.challenge_members m where m.user_id = p.id),
    (select count(*)::int from public.challenge_members m join public.challenges c on c.id = m.challenge_id
      where m.user_id = p.id and not c.cancelled and c.end_date >= current_date),
    greatest(
      (select max(a.local_date) from public.activities a where a.user_id = p.id),
      (select max(l.day) from public.habit_logs l where l.user_id = p.id)
    )
  from public.profiles p;
end $$;
grant execute on function public.admin_member_stats() to authenticated;

-- ===================== 20261016180000_notifications.sql =====================
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

-- ===================== 20261016200000_birthdays_audiences.sql =====================
-- Date of birth (private), challenge audiences by age / country / state, age groups in admin insights.

-- ---------- date of birth: private, alongside height and weight ----------
alter table public.profile_health add column if not exists dob date check (dob between '1900-01-01' and current_date);

-- ---------- audience on challenges (all empty = everyone) ----------
alter table public.challenges
  add column if not exists aud_min_age int check (aud_min_age between 1 and 120),
  add column if not exists aud_max_age int check (aud_max_age between 1 and 120),
  add column if not exists aud_countries text[],
  add column if not exists aud_states text[];

/** Can the signed-in member see (and join) this challenge? Reads the private birthday without exposing it. */
create or replace function public.member_can_see(c public.challenges) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare p record; age int;
begin
  if c.aud_min_age is null and c.aud_max_age is null and coalesce(cardinality(c.aud_countries), 0) = 0 and coalesce(cardinality(c.aud_states), 0) = 0 then
    return true;
  end if;
  select pr.country, pr.state, h.dob into p
    from public.profiles pr left join public.profile_health h on h.user_id = pr.id
   where pr.id = auth.uid();
  if c.aud_min_age is not null or c.aud_max_age is not null then
    if p.dob is null then return false; end if;
    age := date_part('year', age(current_date, p.dob));
    if c.aud_min_age is not null and age < c.aud_min_age then return false; end if;
    if c.aud_max_age is not null and age > c.aud_max_age then return false; end if;
  end if;
  if coalesce(cardinality(c.aud_countries), 0) > 0 and not (coalesce(p.country, '') = any (c.aud_countries)) then return false; end if;
  if coalesce(cardinality(c.aud_states), 0) > 0 and not (coalesce(p.state, '') = any (c.aud_states)) then return false; end if;
  return true;
end $$;

-- Members see challenges meant for them, plus any they already joined. Admins see everything.
drop policy if exists "challenges: members read" on public.challenges;
create policy "challenges: members read" on public.challenges
  for select to authenticated using (
    public.is_admin()
    or public.member_can_see(challenges)
    or exists (select 1 from public.challenge_members m where m.challenge_id = challenges.id and m.user_id = auth.uid())
  );

-- Joining also requires being in the audience.
drop policy if exists "members: join" on public.challenge_members;
create policy "members: join" on public.challenge_members
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.challenges c
       where c.id = challenge_id and not c.cancelled
         and current_date between c.reg_opens and c.join_by
         and public.member_can_see(c)
    )
  );

-- ---------- admin insights: add age group (never the birthday itself) ----------
drop function if exists public.admin_member_stats();
create or replace function public.admin_member_stats()
returns table (user_id uuid, name text, city text, state text, country text, joined_at timestamptz, strava_connected boolean,
               challenges int, live_challenges int, last_active date, age_band text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, coalesce(p.full_name, 'Member'), p.city, p.state, p.country, p.created_at, p.strava_connected,
    (select count(*)::int from public.challenge_members m where m.user_id = p.id),
    (select count(*)::int from public.challenge_members m join public.challenges c on c.id = m.challenge_id
      where m.user_id = p.id and not c.cancelled and c.end_date >= current_date),
    greatest(
      (select max(a.local_date) from public.activities a where a.user_id = p.id),
      (select max(l.day) from public.habit_logs l where l.user_id = p.id)
    ),
    case
      when h.dob is null then 'Not given'
      when date_part('year', age(current_date, h.dob)) < 18 then 'Under 18'
      when date_part('year', age(current_date, h.dob)) < 30 then '18–29'
      when date_part('year', age(current_date, h.dob)) < 45 then '30–44'
      when date_part('year', age(current_date, h.dob)) < 60 then '45–59'
      when date_part('year', age(current_date, h.dob)) < 75 then '60–74'
      else '75+'
    end
  from public.profiles p left join public.profile_health h on h.user_id = p.id;
end $$;
grant execute on function public.admin_member_stats() to authenticated;

-- ===================== 20261018000000_email_signin_strava_links.sql =====================
-- Email-only sign-in, private mobile number, and Strava by link only (no Strava connection).

-- ---------- private mobile number (optional; sign-in is by email) ----------
alter table public.profile_health
  add column if not exists mobile text check (mobile ~ '^\+[1-9][0-9]{5,14}$');

-- Sign-in no longer uses passwords. The column stays for older rows but nothing depends on it.
comment on column public.profiles.password_set is 'Unused since passwordless sign-in (2026-10-18).';

-- ---------- Strava: links only ----------
-- No more Strava logins or tokens.
drop trigger if exists profiles_purge_strava on public.profiles;
drop function if exists public.purge_strava_activities();
drop table if exists public.strava_connections;
alter table public.profiles drop column if exists strava_last_sync;

-- strava_athlete_id / strava_athlete_name / strava_connected are now set by the member's first activity link.
-- One Strava athlete belongs to one member.
create unique index if not exists profiles_strava_athlete_unique on public.profiles (strava_athlete_id) where strava_athlete_id is not null;
comment on column public.profiles.strava_connected is 'True once the member has added a Strava activity link (ties them to strava_athlete_id).';

-- Members may remove an activity they added by mistake. Adding is still server-only (Edge Function).
drop policy if exists "activities: delete own" on public.activities;
create policy "activities: delete own" on public.activities
  for delete to authenticated using (user_id = auth.uid());
alter table public.activities alter column source set default 'link';
-- 'manual': the activity page was readable but not its numbers, so the member typed distance and time.
alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check check (source in ('sync', 'link', 'manual'));

-- ---------- the very first account is the owner (admin) ----------
-- Later sign-ups are members. Admins can still be set by SQL; the separate admin sign-in comes later.
create or replace function public.first_account_is_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    new.role := 'admin';
  end if;
  return new;
end $$;
drop trigger if exists profiles_first_owner on public.profiles;
create trigger profiles_first_owner before insert on public.profiles
  for each row execute function public.first_account_is_owner();
