-- Phone notifications without hand-copied secrets: the notify function creates its own Web Push (VAPID)
-- key pair on first use and keeps it here. Server-only: no client can read this table.
create table if not exists public.app_keys (
  name        text primary key,
  value       text not null,
  created_at  timestamptz not null default now()
);
alter table public.app_keys enable row level security;
revoke all on public.app_keys from anon, authenticated;

-- Who should hear about a new challenge: members who allow alerts and match its audience
-- (age group from the private birthday, country, state). Server-only.
create or replace function public.challenge_audience(cid uuid)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id
    from public.challenges c
    join public.profiles p on true
    left join public.profile_health h on h.user_id = p.id
   where c.id = cid and not c.cancelled and p.notify_new_challenges
     and (c.aud_min_age is null or (h.dob is not null and date_part('year', age(current_date, h.dob)) >= c.aud_min_age))
     and (c.aud_max_age is null or (h.dob is not null and date_part('year', age(current_date, h.dob)) <= c.aud_max_age))
     and (coalesce(cardinality(c.aud_countries), 0) = 0 or coalesce(p.country, '') = any (c.aud_countries))
     and (coalesce(cardinality(c.aud_states), 0) = 0 or coalesce(p.state, '') = any (c.aud_states));
$$;
revoke execute on function public.challenge_audience(uuid) from public, anon, authenticated;
grant execute on function public.challenge_audience(uuid) to service_role;
