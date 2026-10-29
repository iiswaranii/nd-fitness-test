-- Gender: asked (required) when setting up the profile. Only the member and admins can read it
-- (profiles are readable by their owner and admins only). Admin insights get it for gender-wise stats.
alter table public.profiles add column if not exists gender text;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('male', 'female', 'prefer_not'));

drop function if exists public.admin_member_stats();
create or replace function public.admin_member_stats()
returns table (user_id uuid, name text, city text, state text, country text, joined_at timestamptz, strava_connected boolean,
               challenges int, live_challenges int, last_active date, age_band text, gender text)
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
    end,
    p.gender
  from public.profiles p left join public.profile_health h on h.user_id = p.id;
end $$;
grant execute on function public.admin_member_stats() to authenticated;

notify pgrst, 'reload schema';
