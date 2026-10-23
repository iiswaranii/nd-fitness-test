-- Optional start / end time of day for a challenge (in each member's own local time, like the days).
-- An activity counts only if it STARTED inside the window: e.g. a challenge starting 25 Oct 12:00 pm
-- does not count a walk recorded on 25 Oct at 6:00 am. Defaults keep whole days.
alter table public.challenges
  add column if not exists start_time time not null default '00:00',
  add column if not exists end_time   time not null default '23:59';
notify pgrst, 'reload schema';
