-- 1. Any admin can edit any challenge (all fields, dates included, even after members joined).
--    Only the admin who created a challenge can delete (cancel) it.
-- 2. Age-wise targets: a challenge can set a different target for each age group (admin chooses the ranges).
-- 2b. Exercise challenges can be measured in km, miles, steps or active minutes.
-- 3. Members must accept the terms (health and safety consent) to join; the acceptance is stored.

-- ---------- 1. edit vs delete ----------
drop policy if exists "challenges: admin write" on public.challenges;
drop policy if exists "challenges: admin insert" on public.challenges;
drop policy if exists "challenges: admin update" on public.challenges;
drop policy if exists "challenges: creator delete" on public.challenges;

create policy "challenges: admin insert" on public.challenges
  for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "challenges: admin update" on public.challenges
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "challenges: creator delete" on public.challenges
  for delete to authenticated using (public.is_admin() and created_by = auth.uid());

-- Deleting in the app is "cancelled = true" (members' history stays intact). Only the creator may do it,
-- and nobody can change who created a challenge.
create or replace function public.challenges_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if new.cancelled is distinct from old.cancelled
     and auth.uid() is not null and old.created_by is not null and old.created_by <> auth.uid() then
    raise exception 'Only the admin who created this challenge can delete it' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists challenges_guard on public.challenges;
create trigger challenges_guard before update on public.challenges
  for each row execute function public.challenges_guard();

-- ---------- 2. age-wise targets ----------
-- [{ "min": 50, "max": 60, "value": 2000 }, …]. value = daily target for habits, overall target for exercise.
-- min/max are inclusive; null = no limit on that side. Members outside every range use the normal target.
alter table public.challenges add column if not exists age_targets jsonb;
alter table public.challenges drop constraint if exists challenges_age_targets_check;
alter table public.challenges add constraint challenges_age_targets_check
  check (age_targets is null or jsonb_typeof(age_targets) = 'array');

-- Which age group (0-based index into age_targets) each member of a challenge falls in, or null.
-- Gives only the group, never a birthday or an age. Admins and members of the challenge only.
create or replace function public.challenge_target_bands(cid uuid)
returns table (user_id uuid, band int)
language plpgsql stable security definer set search_path = public as $$
declare c public.challenges%rowtype;
begin
  select * into c from public.challenges where id = cid;
  if not found then return; end if;
  if not (public.is_admin() or exists (select 1 from public.challenge_members m where m.challenge_id = cid and m.user_id = auth.uid())) then
    return;
  end if;
  return query
  select m.user_id, (
    select (t.i - 1)::int
      from jsonb_array_elements(coalesce(c.age_targets, '[]'::jsonb)) with ordinality as t(e, i)
     where h.dob is not null
       and (t.e->>'min' is null or date_part('year', age(c.start_date, h.dob)) >= (t.e->>'min')::int)
       and (t.e->>'max' is null or date_part('year', age(c.start_date, h.dob)) <= (t.e->>'max')::int)
     order by t.i limit 1)
  from public.challenge_members m
  left join public.profile_health h on h.user_id = m.user_id
  where m.challenge_id = cid;
end $$;
grant execute on function public.challenge_target_bands(uuid) to authenticated;

-- What an exercise challenge is measured in: km (default), miles, steps (estimated from distance), active minutes.
-- Targets, per-day minimums and age-wise targets are all in this unit.
alter table public.challenges add column if not exists unit text;
alter table public.challenges drop constraint if exists challenges_unit_check;
alter table public.challenges add constraint challenges_unit_check check (unit is null or unit in ('km', 'mi', 'steps', 'min'));

-- ---------- 3. consent to join ----------
alter table public.challenge_members
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

-- The time is the server's, never the phone's.
create or replace function public.members_terms_time() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.terms_accepted_at := case when new.terms_version is null then null else now() end;
  else
    new.terms_accepted_at := old.terms_accepted_at;
    new.terms_version := old.terms_version;
  end if;
  return new;
end $$;
drop trigger if exists members_terms_time on public.challenge_members;
create trigger members_terms_time before insert or update on public.challenge_members
  for each row execute function public.members_terms_time();

-- Joining: same rules as before, plus the member must have accepted the terms.
drop policy if exists "members: join" on public.challenge_members;
create policy "members: join" on public.challenge_members
  for insert to authenticated with check (
    user_id = auth.uid() and terms_version is not null and exists (
      select 1 from public.challenges c
       where c.id = challenge_id and not c.cancelled
         and now() >= coalesce(c.reg_opens_at, (c.reg_opens::timestamp) at time zone 'Etc/GMT-14')
         and now() <= coalesce(c.join_by_at, ((c.join_by + 1)::timestamp) at time zone 'Etc/GMT+12')
         and public.member_can_see(c)
    )
  );

notify pgrst, 'reload schema';
