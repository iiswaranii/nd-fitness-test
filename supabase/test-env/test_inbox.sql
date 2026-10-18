-- TEST ENVIRONMENT ONLY: instead of sending emails, Supabase Auth saves each login code here
-- (Auth Hooks → "Send Email" → Postgres function public.test_send_email).
-- Only the owner/admins can read it: Table Editor in Supabase, or Admin → Test inbox in the app.
-- Before going live: remove the hook and set up SMTP (see README).
create table if not exists public.test_inbox (
  id          bigserial primary key,
  email       text not null,
  kind        text,
  code        text,
  created_at  timestamptz not null default now()
);
alter table public.test_inbox enable row level security;
revoke all on public.test_inbox from anon, authenticated;
grant insert, select on public.test_inbox to supabase_auth_admin;
grant usage on sequence public.test_inbox_id_seq to supabase_auth_admin;

create or replace function public.test_send_email(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into public.test_inbox (email, kind, code)
  values (
    coalesce(event -> 'user' ->> 'new_email', event -> 'user' ->> 'email'),
    event -> 'email_data' ->> 'email_action_type',
    event -> 'email_data' ->> 'token'
  );
  delete from public.test_inbox where created_at < now() - interval '2 days';
  return '{}'::jsonb;
end $$;
revoke execute on function public.test_send_email(jsonb) from public, anon, authenticated;
grant execute on function public.test_send_email(jsonb) to supabase_auth_admin;

-- Admins read the latest codes in the app.
create or replace function public.admin_test_inbox()
returns table (email text, kind text, code text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select t.email, t.kind, t.code, t.created_at from public.test_inbox t
    where t.created_at > now() - interval '1 hour' order by t.created_at desc limit 30;
end $$;
revoke execute on function public.admin_test_inbox() from public, anon;
grant execute on function public.admin_test_inbox() to authenticated;
