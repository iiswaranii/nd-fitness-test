import type { Activity, Challenge, HabitLog } from './types';
import { progress, status } from './progress';
import { dayMet, habitByKey } from './habits';
import { addDays, today } from './dates';

export type BadgeGroup = 'Podium' | 'Milestones' | 'Streaks' | 'Taking part';
export type Tier = 'gold' | 'silver' | 'bronze' | 'green' | 'blue' | 'purple';
export type Badge = {
  id: string; name: string; how: string; group: BadgeGroup; icon: string; tier: Tier;
  earned: boolean; detail?: string; progress?: { now: number; goal: number };
};

/** Finished leaderboard results for this member: challenge id → place and field size. */
export type Placings = Record<string, { rank: number; of: number }>;

/** Best run of consecutive days with a "win": any walk/run/ride, or a habit goal met. */
function bestStreak(acts: Activity[], logs: HabitLog[], cs: Challenge[]): { best: number; current: number } {
  const days = new Set<string>(acts.map((a) => a.date));
  for (const l of logs) {
    const c = cs.find((x) => x.id === l.challenge_id);
    const h = habitByKey(c?.habit_key);
    if (c && h && dayMet(h, c.daily_target ?? h.goal ?? 0, l.value)) days.add(l.date);
  }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev = '';
  for (const d of sorted) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  let current = 0;
  for (let d = days.has(today()) ? today() : addDays(today(), -1); days.has(d); d = addDays(d, -1)) current++;
  return { best, current };
}

export function computeBadges(cs: Challenge[], acts: Activity[], logs: HabitLog[], placings: Placings): Badge[] {
  const joined = cs.filter((c) => c.joined);
  const completed = joined.filter((c) => progress(c, acts, logs).done);
  const habitDone = completed.filter((c) => c.category === 'habit');
  const km = acts.reduce((s, a) => s + a.km, 0);
  const sports = new Set(acts.map((a) => a.sport));
  const kinds = new Set(joined.map((c) => c.category));
  const habitDays = joined.filter((c) => c.category === 'habit').reduce((s, c) => s + progress(c, acts, logs).metDays.length, 0);
  const waterDays = joined.filter((c) => c.habit_key === 'water').reduce((s, c) => s + progress(c, acts, logs).metDays.length, 0);
  const sleepDays = joined.filter((c) => c.habit_key === 'sleep-early').reduce((s, c) => s + progress(c, acts, logs).metDays.length, 0);
  const early = acts.some((a) => a.time < '06:00');
  const { best } = bestStreak(acts, logs, cs);
  const places = Object.entries(placings);
  const nameOf = (id: string) => cs.find((c) => c.id === id)?.title ?? 'a challenge';
  const placed = (r: number) => places.find(([, p]) => p.rank === r);
  const top10 = places.find(([, p]) => p.rank <= 10 && p.of >= 5);

  const b = (id: string, name: string, how: string, group: BadgeGroup, icon: string, tier: Tier, now: number, goal: number, detail?: string): Badge =>
    ({ id, name, how, group, icon, tier, earned: now >= goal, progress: { now: Math.min(now, goal), goal }, detail });

  return [
    // Podium — finishing places on leaderboard challenges
    { id: 'first', name: 'Pace Setter', how: 'Finish 1st on a challenge leaderboard', group: 'Podium', icon: 'trophy', tier: 'gold', earned: !!placed(1), detail: placed(1) ? `1st in ${nameOf(placed(1)![0])}` : undefined },
    { id: 'second', name: 'Silver Stride', how: 'Finish 2nd on a challenge leaderboard', group: 'Podium', icon: 'trophy', tier: 'silver', earned: !!placed(2), detail: placed(2) ? `2nd in ${nameOf(placed(2)![0])}` : undefined },
    { id: 'third', name: 'Bronze Spirit', how: 'Finish 3rd on a challenge leaderboard', group: 'Podium', icon: 'trophy', tier: 'bronze', earned: !!placed(3), detail: placed(3) ? `3rd in ${nameOf(placed(3)![0])}` : undefined },
    { id: 'top10', name: 'Top Ten', how: 'Finish in the top 10 of a challenge with 5+ members', group: 'Podium', icon: 'podium', tier: 'blue', earned: !!top10, detail: top10 ? `#${top10[1].rank} in ${nameOf(top10[0])}` : undefined },

    // Milestones
    b('act1', 'First Steps', 'Sync your first walk, run or ride', 'Milestones', 'walk', 'green', acts.length, 1),
    b('km10', '10 km Club', 'Cover 10 km in total', 'Milestones', 'walk', 'bronze', Math.floor(km), 10),
    b('km50', '50 km Club', 'Cover 50 km in total', 'Milestones', 'walk', 'silver', Math.floor(km), 50),
    b('km100', 'Century', 'Cover 100 km in total', 'Milestones', 'walk', 'gold', Math.floor(km), 100),
    b('km250', 'Road Runner', 'Cover 250 km in total', 'Milestones', 'run', 'purple', Math.floor(km), 250),
    b('km500', 'Long Haul', 'Cover 500 km in total', 'Milestones', 'ride', 'purple', Math.floor(km), 500),
    b('km1000', 'Thousand Club', 'Cover 1,000 km in total', 'Milestones', 'ride', 'gold', Math.floor(km), 1000),
    b('early', 'Early Bird', 'Start an activity before 6 am', 'Milestones', 'sun', 'blue', early ? 1 : 0, 1),
    b('all3', 'All-Rounder', 'Walk, run and ride', 'Milestones', 'sparkle', 'purple', sports.size, 3),
    b('habit10', 'Habit Builder', 'Hit a habit goal on 10 days', 'Milestones', 'leaf', 'green', habitDays, 10),
    b('habit50', 'Habit Master', 'Hit a habit goal on 50 days', 'Milestones', 'leaf', 'gold', habitDays, 50),
    b('water7', 'Hydration Hero', 'Reach your water goal on 7 days', 'Milestones', 'drop', 'blue', waterDays, 7),
    b('sleep7', 'Sleep Champion', 'Go to bed on time on 7 days', 'Milestones', 'moon', 'purple', sleepDays, 7),

    // Streaks
    b('s3', '3-Day Streak', 'Win 3 days in a row (any activity or habit goal)', 'Streaks', 'sparkle', 'bronze', best, 3),
    b('s7', 'Week Warrior', 'Win 7 days in a row', 'Streaks', 'sparkle', 'silver', best, 7),
    b('s14', 'Fortnight Focus', 'Win 14 days in a row', 'Streaks', 'sparkle', 'gold', best, 14),
    b('s30', 'Unstoppable', 'Win 30 days in a row', 'Streaks', 'sparkle', 'purple', best, 30),

    // Taking part
    b('join1', 'I’m In', 'Join your first challenge', 'Taking part', 'plus', 'green', joined.length, 1),
    b('join3', 'Team Player', 'Join 3 challenges', 'Taking part', 'users', 'bronze', joined.length, 3),
    b('join5', 'Regular', 'Join 5 challenges', 'Taking part', 'users', 'silver', joined.length, 5),
    b('join10', 'Community Pillar', 'Join 10 challenges', 'Taking part', 'users', 'gold', joined.length, 10),
    b('both', 'Body & Mind', 'Join an exercise and a habit challenge', 'Taking part', 'heart', 'purple', kinds.size, 2),
    b('done1', 'Finisher', 'Complete a challenge', 'Taking part', 'check', 'green', completed.length, 1),
    b('done3', 'Triple Finisher', 'Complete 3 challenges', 'Taking part', 'check', 'silver', completed.length, 3),
    b('habitdone', 'Habit Hero', 'Complete a healthy-habit challenge', 'Taking part', 'leaf', 'gold', habitDone.length, 1),
    b('finished', 'Saw It Through', 'Stay in a challenge until it ends', 'Taking part', 'cal', 'blue', joined.filter((c) => status(c) === 'finished').length, 1),
  ];
}

export { bestStreak };
