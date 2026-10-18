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
