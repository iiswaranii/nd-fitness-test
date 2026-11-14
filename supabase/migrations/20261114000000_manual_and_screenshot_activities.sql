-- Activities without Strava: members can add a walk, run or ride by hand, or from a screenshot of another
-- fitness app (Google Fit, Samsung Health, Apple Health…). The app reads the screenshot on the phone and the
-- member checks the numbers before saving. Steps are kept when given.

alter table public.activities add column if not exists steps int;
alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check check (source in ('sync', 'link', 'manual', 'screenshot'));

-- Ids for activities that aren't from Strava: negative, so they never collide with Strava's ids.
create sequence if not exists public.manual_activity_seq;

create or replace function public.add_manual_activity(
  p_sport text, p_date date, p_time time, p_km numeric, p_steps int, p_moving_s int, p_source text default 'manual'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  spk numeric := case p_sport when 'run' then 1100 else 1300 end;   -- average steps per km
  km numeric;
  act public.activities%rowtype;
begin
  if me is null then raise exception 'Please log in again.'; end if;
  if p_sport not in ('walk', 'run', 'ride') then raise exception 'Choose walk, run or ride.'; end if;
  if p_source not in ('manual', 'screenshot') then raise exception 'Unknown source.'; end if;
  -- Today (anywhere on Earth) back to 7 days ago.
  if p_date > (now() at time zone 'Etc/GMT-14')::date or p_date < (now() at time zone 'Etc/GMT+12')::date - 7 then
    raise exception 'You can add activities from the last 7 days.';
  end if;
  if p_steps is not null and (p_steps < 0 or p_steps > 100000) then raise exception 'Steps should be between 0 and 100,000.'; end if;
  if p_sport = 'ride' and p_steps is not null then raise exception 'Steps don’t apply to rides.'; end if;
  km := coalesce(nullif(p_km, 0), case when p_steps is not null then p_steps / spk end);
  if km is null or km <= 0 then raise exception 'Add the distance or the steps.'; end if;
  if km > (case p_sport when 'ride' then 400 else 100 end) then raise exception 'That distance looks too long for one activity.'; end if;
  if p_moving_s is not null and (p_moving_s < 0 or p_moving_s > 86400) then raise exception 'Check the time.'; end if;

  insert into public.activities (id, user_id, sport, name, start_utc, local_date, local_time, distance_m, moving_s, elapsed_s, elev_m, source, steps)
  values (-nextval('public.manual_activity_seq'), me, p_sport,
          case p_sport when 'walk' then 'Walk' when 'run' then 'Run' else 'Ride' end || case p_source when 'screenshot' then ' (from screenshot)' else ' (added by hand)' end,
          now(), p_date, coalesce(p_time, '12:00'), round(km * 1000), coalesce(p_moving_s, 0), coalesce(p_moving_s, 0), null, p_source, p_steps)
  returning * into act;
  return to_jsonb(act);
end $$;
revoke execute on function public.add_manual_activity(text, date, time, numeric, int, int, text) from public, anon;
grant execute on function public.add_manual_activity(text, date, time, numeric, int, int, text) to authenticated;

-- Disconnecting Strava removes only Strava activities, never ones added by hand or from a screenshot.
create or replace function public.purge_strava_activities() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.strava_connected and not new.strava_connected then
    delete from public.activities where user_id = new.id and source in ('sync', 'link');
  end if;
  return new;
end $$;

-- Leaderboards carry steps and where each activity came from.
drop function if exists public.challenge_board(uuid);
create or replace function public.challenge_board(cid uuid)
returns table (user_id uuid, name text, city text, country text, tz text, activities jsonb, logs jsonb)
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
  select m.user_id, coalesce(p.full_name, 'Member'), p.city, p.country, p.tz,
    case when c.category = 'activity' then coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id::text, 'sport', a.sport, 'name', '', 'date', a.local_date, 'time', to_char(a.local_time, 'HH24:MI'),
             'km', a.distance_m / 1000.0, 'moving_s', a.moving_s, 'elapsed_s', a.elapsed_s, 'elev_m', null, 'source', a.source, 'steps', a.steps))
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
