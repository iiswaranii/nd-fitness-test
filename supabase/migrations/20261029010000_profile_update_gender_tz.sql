-- Members may update their own gender and phone time zone (column-level grant; the row policy
-- "profiles: update own" still limits it to their own profile). Role and Strava fields stay server-only.
grant update (full_name, city, state, country, password_set, notify_new_challenges, gender, tz) on public.profiles to authenticated;
notify pgrst, 'reload schema';
