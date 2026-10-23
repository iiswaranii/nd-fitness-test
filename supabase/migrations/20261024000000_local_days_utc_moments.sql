-- Time zones, the way Strava / Apple Fitness challenges work:
--  • Challenge days (start_date … end_date) are calendar days in EACH member's own time zone.
--    Everyone gets the same full local days; activities count by the date they were recorded locally,
--    habit logs by the member's phone date.
--  • Moments are exact instants stored in UTC (timestamptz) and shown in each phone's local time:
--    registration opens / last moment to join (new columns), joined_at, created_at, activity start.

alter table public.challenges
  add column if not exists reg_opens_at timestamptz,
  add column if not exists join_by_at   timestamptz;

-- Older rows: treat the dates as India time (start of reg_opens day → end of join_by day).
update public.challenges set
  reg_opens_at = coalesce(reg_opens_at, (reg_opens::timestamp) at time zone 'Asia/Kolkata'),
  join_by_at   = coalesce(join_by_at, ((join_by + 1)::timestamp - interval '1 second') at time zone 'Asia/Kolkata');

alter table public.challenges drop constraint if exists challenges_join_window_check;
alter table public.challenges add constraint challenges_join_window_check
  check (reg_opens_at is null or join_by_at is null or reg_opens_at < join_by_at);

-- Joining: between the two exact moments (falls back to the old day-based rule if they're missing).
drop policy if exists "members: join" on public.challenge_members;
create policy "members: join" on public.challenge_members
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.challenges c
       where c.id = challenge_id and not c.cancelled
         and now() >= coalesce(c.reg_opens_at, (c.reg_opens::timestamp) at time zone 'Etc/GMT-14')
         and now() <= coalesce(c.join_by_at, ((c.join_by + 1)::timestamp) at time zone 'Etc/GMT+12')
         and public.member_can_see(c)
    )
  );

-- Habit logs: "today" is the member's own date. Accept any date that is today somewhere on Earth
-- (UTC-12 … UTC+14), back to 4 days before that, and inside the challenge.
drop policy if exists "logs: write own" on public.habit_logs;
create policy "logs: write own" on public.habit_logs
  for all to authenticated
  using (user_id = auth.uid() and day >= (now() at time zone 'Etc/GMT+12')::date - 4)
  with check (
    user_id = auth.uid()
    and day between (now() at time zone 'Etc/GMT+12')::date - 4 and (now() at time zone 'Etc/GMT-14')::date
    and exists (
      select 1 from public.challenge_members m join public.challenges c on c.id = m.challenge_id
       where m.challenge_id = habit_logs.challenge_id and m.user_id = auth.uid()
         and habit_logs.day between c.start_date and c.end_date
    )
  );

notify pgrst, 'reload schema';
