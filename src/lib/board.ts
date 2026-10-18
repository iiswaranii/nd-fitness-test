import type { Challenge, Participant } from './types';
import { progress, totalDays } from './progress';
import { habitByKey, fmtAmount } from './habits';
import { addDays, today } from './dates';

/** Leaderboards only where "more" is genuinely better: all exercise challenges and selected habits (steps, push-ups, yoga minutes…). */
export function hasBoard(c: Challenge): boolean {
  if (c.category === 'activity') return true;
  return !!habitByKey(c.habit_key)?.board;
}

export type BoardRow = { user_id: string; name: string; city: string | null; value: number; label: string; me: boolean; loggedToday: boolean; days: number };

export function rankBoard(c: Challenge, ps: Participant[], meId: string | null): BoardRow[] {
  const h = habitByKey(c.habit_key);
  const t = today();
  return ps.map((p) => {
    const pr = progress({ ...c, joined: true }, p.activities, p.logs);
    let value = pr.value, label = '';
    if (c.category === 'activity') {
      label = c.metric === 'distance' ? `${value.toFixed(1)} km` : c.metric === 'days' ? `${value} days` : `${value} ${c.sport === 'ride' ? 'rides' : c.sport === 'run' ? 'runs' : 'walks'}`;
    } else {
      const end = c.end_date < t ? c.end_date : t;
      value = p.logs.filter((l) => l.challenge_id === c.id && l.date >= c.start_date && l.date <= end).reduce((s, l) => s + l.value, 0);
      label = fmtAmount(Math.round(value), h?.unit);
    }
    const loggedToday = c.category === 'habit'
      ? p.logs.some((l) => l.challenge_id === c.id && l.date === t)
      : p.activities.some((a) => a.sport === c.sport && a.date === t);
    return { user_id: p.user_id, name: p.name, city: p.city, value, label, me: p.user_id === meId, loggedToday, days: pr.metDays.length };
  }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/** A warm, specific nudge for the member — never about beating anyone, always about the next step. */
export function nudge(c: Challenge, rows: BoardRow[]): string {
  const i = rows.findIndex((r) => r.me);
  if (i < 0) return 'Join in — every step you take counts toward the group’s total.';
  const me = rows[i];
  const unit = c.category === 'activity' && c.metric === 'distance' ? 'km' : '';
  if (me.value === 0) return 'Your first entry is the hardest one. Log today and you’re on the board!';
  if (i === 0) return 'You’re setting the pace for everyone. Keep that rhythm going!';
  const gap = rows[i - 1].value - me.value;
  if (c.category === 'activity' && c.metric === 'distance') return `Just ${gap.toFixed(1)} ${unit} more and you move up a spot. One more walk could do it!`;
  if (c.category === 'activity') return `${Math.ceil(gap)} more to move up. You’re closer than you think!`;
  const h = habitByKey(c.habit_key);
  return `${fmtAmount(Math.ceil(gap), h?.unit)} more to move up a spot. You’ve got this!`;
}

/** Group totals for the "we're in this together" card on challenges without a leaderboard. */
export function together(c: Challenge, rows: BoardRow[]) {
  const logged = rows.filter((r) => r.loggedToday).length;
  const days = rows.reduce((s, r) => s + r.days, 0);
  return { members: rows.length, loggedToday: logged, groupDays: days, total: totalDays(c) };
}

/** This week vs last week for the member, in the challenge's own unit (for "you vs you"). */
export function weekOverWeek(c: Challenge, p: Participant | undefined): { now: number; prev: number } | null {
  if (!p) return null;
  const t = today();
  const sum = (from: string, to: string) => c.category === 'activity'
    ? p.activities.filter((a) => a.sport === c.sport && a.date >= from && a.date <= to).reduce((s, a) => s + a.km, 0)
    : p.logs.filter((l) => l.challenge_id === c.id && l.date >= from && l.date <= to).reduce((s, l) => s + l.value, 0);
  return { now: sum(addDays(t, -6), t), prev: sum(addDays(t, -13), addDays(t, -7)) };
}
