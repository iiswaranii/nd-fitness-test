import type { Activity, Challenge, HabitLog } from './types';
import { addDays, diffDays, today } from './dates';
import { dayMet, habitByKey } from './habits';

export type Status = 'upcoming' | 'active' | 'finished' | 'cancelled';

export function status(c: Challenge): Status {
  if (c.cancelled) return 'cancelled';
  const t = today();
  if (t < c.start_date) return 'upcoming';
  if (t > c.end_date) return 'finished';
  return 'active';
}

export const regOpen = (c: Challenge) => today() >= c.reg_opens;
export const canJoin = (c: Challenge) =>
  !c.joined && c.eligible !== false && (status(c) === 'active' || status(c) === 'upcoming') && regOpen(c) && today() <= c.join_by;
export const daysLeft = (c: Challenge) => diffDays(today(), c.end_date) + 1;
export const totalDays = (c: Challenge) => diffDays(c.start_date, c.end_date) + 1;
/** Which day of the challenge today is (1-based), clamped to the challenge's length. */
export const dayOf = (c: Challenge) => Math.min(totalDays(c), Math.max(1, diffDays(c.start_date, today()) + 1));
/** "Day 2 of 3" · "Last day · day 3 of 3" */
export const dayText = (c: Challenge) => { const d = dayOf(c), t = totalDays(c); return d === t ? `Last day · day ${d} of ${t}` : `Day ${d} of ${t}`; };

export type Progress = {
  value: number;
  pct: number;
  remaining: number;
  done: boolean;
  /** activity challenges: activities that counted */
  counted: Activity[];
  km: number;
  /** habit challenges: days whose target was met */
  metDays: string[];
  /** today's habit value and whether it's met */
  todayValue: number | null;
  todayMet: boolean;
  /** on track vs. a straight-line pace */
  onTrack: boolean;
};

export function unitOf(c: Challenge): string {
  if (c.category === 'habit') return 'days';
  return c.metric === 'distance' ? 'km' : c.metric === 'days' ? 'days' : 'activities';
}

export function fmtValue(c: Challenge, v: number): string {
  return c.category === 'activity' && c.metric === 'distance' ? (v >= 100 ? v.toFixed(0) : v.toFixed(1)) : String(Math.round(v));
}

export function goalText(c: Challenge): string {
  if (c.category === 'habit') {
    const days = totalDays(c);
    return c.target >= days ? `Every day for ${days} days` : `Hit your daily goal on ${c.target} of ${days} days`;
  }
  const verb = c.sport === 'walk' ? 'Walk' : c.sport === 'run' ? 'Run' : 'Ride';
  if (c.metric === 'distance') return `${verb} ${c.target} km in total`;
  if (c.metric === 'days') return `${verb} at least ${c.daily_min} km on ${c.target} days`;
  return `${c.target} ${c.sport === 'walk' ? 'walks' : c.sport === 'run' ? 'runs' : 'rides'} of ${c.min_km} km or more`;
}

export function progress(c: Challenge, acts: Activity[], logs: HabitLog[]): Progress {
  const t = today();
  const end = c.end_date < t ? c.end_date : t;
  let value = 0, counted: Activity[] = [], metDays: string[] = [], todayValue: number | null = null, todayMet = false;

  if (c.category === 'activity') {
    const inRange = acts.filter((a) => a.sport === c.sport && a.date >= c.start_date && a.date <= end);
    if (c.metric === 'distance') { counted = inRange; value = inRange.reduce((s, a) => s + a.km, 0); }
    else if (c.metric === 'days') {
      const by: Record<string, number> = {};
      inRange.forEach((a) => { by[a.date] = (by[a.date] ?? 0) + a.km; });
      const ok = Object.keys(by).filter((d) => by[d] >= (c.daily_min ?? 0) - 1e-9);
      counted = inRange.filter((a) => ok.includes(a.date));
      value = ok.length; metDays = ok;
    } else { counted = inRange.filter((a) => a.km >= (c.min_km ?? 0)); value = counted.length; }
    if (c.my_daily_target) {
      todayValue = acts.filter((a) => a.sport === c.sport && a.date === t).reduce((s, a) => s + a.km, 0);
      todayMet = todayValue >= c.my_daily_target;
    }
  } else {
    const h = habitByKey(c.habit_key);
    const target = c.daily_target ?? h?.goal ?? 0;
    const mine = logs.filter((l) => l.challenge_id === c.id && l.date >= c.start_date && l.date <= end);
    metDays = h ? mine.filter((l) => dayMet(h, target, l.value)).map((l) => l.date) : [];
    value = metDays.length;
    const tl = logs.find((l) => l.challenge_id === c.id && l.date === t);
    todayValue = tl ? tl.value : null;
    todayMet = !!h && dayMet(h, target, todayValue);
  }

  const pct = Math.min(100, (value / Math.max(1, c.target)) * 100);
  const elapsed = Math.max(0, Math.min(totalDays(c), diffDays(c.start_date, t) + 1));
  const expected = (c.target * elapsed) / totalDays(c);
  return {
    value, pct, remaining: Math.max(0, c.target - value), done: value >= c.target,
    counted, km: counted.reduce((s, a) => s + a.km, 0), metDays, todayValue, todayMet,
    onTrack: value >= expected * 0.95,
  };
}

/** Days of a challenge up to today, newest first — for the habit history strip. */
export function challengeDays(c: Challenge, max = 14): string[] {
  const t = today();
  const end = c.end_date < t ? c.end_date : t;
  const out: string[] = [];
  for (let d = end; d >= c.start_date && out.length < max; d = addDays(d, -1)) out.push(d);
  return out;
}
