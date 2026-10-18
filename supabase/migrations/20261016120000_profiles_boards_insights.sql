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
