-- Namdhari Health & Fitness — members and Strava connections.
-- Members only: there is no admin role in this phase.

create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  full_name            text,
  city                 text,
  email                text,
  phone                text,
  password_set         boolean not null default false,
  strava_connected     boolean not null default false,
  strava_athlete_id    bigint,
  strava_athlete_name  text,
  strava_connected_at  timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Members can read and edit only their own profile.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Members may only change these columns; Strava fields are written by the server.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, city, password_set) on public.profiles to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every new sign-up (Google, email or phone).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email/phone in the profile in step with the login record.
create or replace function public.handle_user_contact_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set email = new.email, phone = nullif(new.phone, '')
   where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_contact_change on auth.users;
create trigger on_auth_user_contact_change after update of email, phone on auth.users
  for each row execute function public.handle_user_contact_change();

-- Strava tokens. No client policies: only Edge Functions (service role) can read or write them.
create table if not exists public.strava_connections (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  athlete_id     bigint not null unique,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  scope          text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.strava_connections enable row level security;
revoke all on public.strava_connections from authenticated, anon;

drop trigger if exists strava_touch on public.strava_connections;
create trigger strava_touch before update on public.strava_connections
  for each row execute function public.touch_updated_at();
