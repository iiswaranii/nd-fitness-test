-- Removing an activity in the app hides it from the member's list and from live challenges, but challenges
-- that had already finished keep it, so their results, leaderboards and trophies never change afterwards.
alter table public.activities add column if not exists removed_at timestamptz;

-- Does an activity still count for a challenge ending on end_date? Yes unless it was removed before that
-- challenge was over (over = end_date has passed everywhere, i.e. from the start of end_date+1 at UTC+14).
create or replace function public.activity_counts(removed timestamptz, end_date date) returns boolean
language sql stable as $$
  select removed is null or removed >= ((end_date + 1)::timestamp at time zone 'Etc/GMT-14');
$$;
grant execute on function public.activity_counts(timestamptz, date) to authenticated;

-- Members "delete" their own activities by marking them removed (nothing is erased).
create or replace function public.remove_activity(aid bigint) returns void
language sql security definer set search_path = public as $$
  update public.activities set removed_at = now() where id = aid and user_id = auth.uid() and removed_at is null;
$$;
revoke execute on function public.remove_activity(bigint) from public, anon;
grant execute on function public.remove_activity(bigint) to authenticated;
drop policy if exists "activities: delete own" on public.activities;

drop function if exists public.challenge_board(uuid);
create or replace function public.challenge_board(cid uuid)
returns table (user_id uuid, name text, city text, country text, activities jsonb, logs jsonb)
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
  select m.user_id, coalesce(p.full_name, 'Member'), p.city, p.country,
    case when c.category = 'activity' then coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id::text, 'sport', a.sport, 'name', '', 'date', a.local_date, 'time', to_char(a.local_time, 'HH24:MI'),
             'km', a.distance_m / 1000.0, 'moving_s', a.moving_s, 'elapsed_s', a.elapsed_s, 'elev_m', null, 'source', 'sync'))
        from public.activities a
       where a.user_id = m.user_id and a.sport = c.sport and a.local_date between c.start_date and c.end_date
         and public.activity_counts(a.removed_at, c.end_date)), '[]'::jsonb)
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
