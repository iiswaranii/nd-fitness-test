-- TEST ENVIRONMENT ONLY: fixed sign-up code for testers (used by the test-signup function).
-- Switch off: delete from public.app_keys where name = 'test_code';
insert into public.app_keys (name, value) values ('test_code', '123456')
on conflict (name) do update set value = excluded.value;
