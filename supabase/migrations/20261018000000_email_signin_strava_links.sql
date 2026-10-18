-- Email-only sign-in, private mobile number, and Strava by link only (no Strava connection).

-- ---------- private mobile number (optional; sign-in is by email) ----------
alter table public.profile_health
  add column if not exists mobile text check (mobile ~ '^\+[1-9][0-9]{5,14}$');

-- Sign-in no longer uses passwords. The column stays for older rows but nothing depends on it.
comment on column public.profiles.password_set is 'Unused since passwordless sign-in (2026-10-18).';

-- ---------- Strava: links only ----------
-- No more Strava logins or tokens.
drop trigger if exists profiles_purge_strava on public.profiles;
drop function if exists public.purge_strava_activities();
drop table if exists public.strava_connections;
alter table public.profiles drop column if exists strava_last_sync;

-- strava_athlete_id / strava_athlete_name / strava_connected are now set by the member's first activity link.
-- One Strava athlete belongs to one member.
create unique index if not exists profiles_strava_athlete_unique on public.profiles (strava_athlete_id) where strava_athlete_id is not null;
comment on column public.profiles.strava_connected is 'True once the member has added a Strava activity link (ties them to strava_athlete_id).';

-- Members may remove an activity they added by mistake. Adding is still server-only (Edge Function).
drop policy if exists "activities: delete own" on public.activities;
create policy "activities: delete own" on public.activities
  for delete to authenticated using (user_id = auth.uid());
alter table public.activities alter column source set default 'link';
-- 'manual': the activity page was readable but not its numbers, so the member typed distance and time.
alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check check (source in ('sync', 'link', 'manual'));

-- ---------- the very first account is the owner (admin) ----------
-- Later sign-ups are members. Admins can still be set by SQL; the separate admin sign-in comes later.
create or replace function public.first_account_is_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    new.role := 'admin';
  end if;
  return new;
end $$;
drop trigger if exists profiles_first_owner on public.profiles;
create trigger profiles_first_owner before insert on public.profiles
  for each row execute function public.first_account_is_owner();
