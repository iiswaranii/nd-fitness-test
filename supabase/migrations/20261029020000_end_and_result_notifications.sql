-- Remember which "last day" and "results are in" notifications each member already got.
alter table public.challenge_members
  add column if not exists ending_notified date,
  add column if not exists result_notified boolean not null default false;
notify pgrst, 'reload schema';
