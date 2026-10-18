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
