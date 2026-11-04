import type { Activity, Challenge, HabitLog, Sport } from './types';
import { addDays, diffDays, parse, today, ymd } from './dates';
import { dayMet, habitByKey } from './habits';

/**
 * Personal weekly / monthly stats, worked out on the phone from data the app already has
 * (the member's own activities and habit logs). Nothing extra is read from the database.
 */
export type Period = 'week' | 'month';

export type Range = { from: string; to: string; label: string; days: string[] };

/** The week (Mon–Sun) or month `offset` periods back from today (0 = this one). */
export function rangeOf(p: Period, offset: number, now = today()): Range {
  if (p === 'week') {
    const d = parse(now);
    const monday = addDays(now, -((d.getDay() + 6) % 7) + offset * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const a = parse(days[0]), b = parse(days[6]);
    const label = offset === 0 ? 'This week' : offset === -1 ? 'Last week'
      : `${a.getDate()} ${a.toLocaleDateString('en-GB', { month: 'short' })} – ${b.getDate()} ${b.toLocaleDateString('en-GB', { month: 'short' })}`;
    return { from: days[0], to: days[6], label, days };
  }
  const base = parse(now);
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const from = ymd(first), to = ymd(last);
  const days = Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i));
  const label = offset === 0 ? 'This month' : first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return { from, to, label, days };
}

export type Stats = {
  km: number;
  seconds: number;
  activities: number;
  activeDays: number;
  /** days of the period up to today (for "x of y days") */
  daysSoFar: number;
  habitMet: number;
  habitPossible: number;
  bySport: Record<Sport, { km: number; n: number; s: number }>;
  /** km per day */
  perDay: Record<string, number>;
  bestDay: { date: string; km: number } | null;
};

export function statsFor(r: Range, acts: Activity[], logs: HabitLog[], challenges: Challenge[], now = today()): Stats {
  const inR = (d: string) => d >= r.from && d <= r.to;
  const a = acts.filter((x) => !x.removed_at && inR(x.date));
  const bySport: Stats['bySport'] = { walk: { km: 0, n: 0, s: 0 }, run: { km: 0, n: 0, s: 0 }, ride: { km: 0, n: 0, s: 0 } };
  const perDay: Record<string, number> = {};
  const active = new Set<string>();
  for (const x of a) {
    bySport[x.sport].km += x.km; bySport[x.sport].n += 1; bySport[x.sport].s += x.moving_s || x.elapsed_s || 0;
    perDay[x.date] = (perDay[x.date] ?? 0) + x.km;
    active.add(x.date);
  }
  // Habits: each day of each joined habit challenge (up to today) is one chance; a met day is a win.
  let met = 0, possible = 0;
  for (const c of challenges) {
    if (!c.joined || c.category !== 'habit') continue;
    const h = habitByKey(c.habit_key); if (!h) continue;
    const target = c.daily_target ?? h.goal ?? 0;
    for (const d of r.days) {
      if (d < c.start_date || d > c.end_date || d > now) continue;
      possible++;
      const l = logs.find((x) => x.challenge_id === c.id && x.date === d);
      if (l && dayMet(h, target, l.value)) { met++; active.add(d); }
    }
  }
  const best = Object.entries(perDay).sort((x, y) => y[1] - x[1])[0];
  return {
    km: a.reduce((s, x) => s + x.km, 0),
    seconds: a.reduce((s, x) => s + (x.moving_s || x.elapsed_s || 0), 0),
    activities: a.length,
    activeDays: active.size,
    daysSoFar: r.days.filter((d) => d <= now).length,
    habitMet: met, habitPossible: possible,
    bySport, perDay,
    bestDay: best ? { date: best[0], km: best[1] } : null,
  };
}

/** A friendly distance goal for the ring: your usual (average of the 4 periods before), never below a small floor. */
export function usualKm(p: Period, offset: number, acts: Activity[], challenges: Challenge[], logs: HabitLog[]): number {
  const prev = [1, 2, 3, 4].map((k) => statsFor(rangeOf(p, offset - k), acts, logs, challenges).km);
  const avg = prev.reduce((s, x) => s + x, 0) / prev.length;
  const floor = p === 'week' ? 5 : 20;
  return Math.max(floor, Math.round(avg));
}

/** Consecutive active days ending today (or yesterday, so today isn't "lost" before you've moved). */
export function currentStreak(acts: Activity[], logs: HabitLog[], challenges: Challenge[]): number {
  const active = (d: string) => statsFor({ from: d, to: d, label: '', days: [d] }, acts, logs, challenges).activeDays > 0;
  let d = today();
  if (!active(d)) d = addDays(d, -1);
  let n = 0;
  while (n < 400 && active(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** "+18%" style change, or null when there's nothing to compare. */
export const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
