-- Everyone can see every challenge and, once it has started, its leaderboard. Only members who fit the
-- challenge's audience (age group from the private birthday, country, state) can join and take part.

-- 1. Reading challenges: all signed-in members.
drop policy if exists "challenges: members read" on public.challenges;
create policy "challenges: members read" on public.challenges
  for select to authenticated using (true);

-- 2. "eligible" for the signed-in member, readable as a column (select *, eligible:member_can_see).
grant execute on function public.member_can_see(public.challenges) to authenticated;

-- 3. Joining still requires being in the audience (policy "members: join" checks member_can_see). Unchanged.

-- 4. Leaderboard: members, admins, and — once the challenge has started — anyone (view only).
create or replace function public.challenge_board(cid uuid)
returns table (user_id uuid, name text, city text, activities jsonb, logs jsonb)
language plpgsql stable security definer set search_path = public as $$
declare c public.challenges%rowtype;
begin
  select * into c from public.challenges where id = cid;
  if not found then return; end if;
  if not (public.is_admin()
          or exists (select 1 from public.challenge_members where challenge_id = cid and challenge_members.user_id = auth.uid())
          or (not c.cancelled and (now() at time zone 'Etc/GMT-14')::date >= c.start_date)) then
    raise exception 'This leaderboard opens when the challenge starts';
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

notify pgrst, 'reload schema';
