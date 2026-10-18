-- Registration dates are calendar days in the member's own time zone, but the database runs on UTC.
-- Members ahead of UTC (India is +5:30) were refused on the day registration opened. Accept a join while
-- the open/close day is "today" somewhere on Earth (UTC-12 … UTC+14).
drop policy if exists "members: join" on public.challenge_members;
create policy "members: join" on public.challenge_members
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.challenges c
       where c.id = challenge_id and not c.cancelled
         and (now() at time zone 'Etc/GMT-14')::date >= c.reg_opens
         and (now() at time zone 'Etc/GMT+12')::date <= c.join_by
         and public.member_can_see(c)
    )
  );
