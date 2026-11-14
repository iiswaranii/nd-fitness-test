import type { Activity, Challenge, Sport } from './types';

/**
 * What an exercise challenge is measured in. Strava gives distance and moving time for every activity,
 * so everything is worked out from those:
 *   km · miles · steps (estimated from distance) · active minutes (moving time)
 */
export type DistUnit = 'km' | 'mi' | 'steps' | 'min';

/** Average steps per km. Strava doesn't share step counts, so steps are estimated from distance. */
export const STEPS_PER_KM: Record<Sport, number> = { walk: 1300, run: 1100, ride: 0 };

export const UNITS: Record<DistUnit, { name: string; short: string; long: string; one: string; ride: boolean }> = {
  km: { name: 'Kilometres', short: 'km', long: 'km', one: 'km', ride: true },
  mi: { name: 'Miles', short: 'mi', long: 'miles', one: 'mile', ride: true },
  steps: { name: 'Steps', short: 'steps', long: 'steps', one: 'step', ride: false },
  min: { name: 'Active minutes', short: 'min', long: 'active minutes', one: 'active minute', ride: true },
};

export const unitKey = (c: Pick<Challenge, 'unit'>): DistUnit => c.unit ?? 'km';

/** How much one activity counts for, in the challenge's unit. */
export function amountOf(c: Pick<Challenge, 'unit' | 'sport'>, a: Pick<Activity, 'km' | 'moving_s' | 'steps'>): number {
  switch (unitKey(c)) {
    case 'mi': return a.km / 1.609344;
    case 'steps': return a.steps ?? a.km * (STEPS_PER_KM[c.sport ?? 'walk'] || STEPS_PER_KM.walk);   // real steps when given
    case 'min': return (a.moving_s || 0) / 60;
    default: return a.km;
  }
}

/** 12.40 km · 3.10 mi · 16,120 steps · 245 min */
export function fmtIn(u: DistUnit, v: number): string {
  if (u === 'km' || u === 'mi') return v >= 1000 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2);
  return Math.round(v).toLocaleString('en-IN');
}
/** For targets and thresholds the admin typed: no forced decimals. */
export const fmtNum = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-IN') : String(+v.toFixed(2)));

/** Sensible starting numbers when the admin switches unit. */
export const DEFAULTS: Record<DistUnit, { total: number; perDay: number }> = {
  km: { total: 50, perDay: 3 }, mi: { total: 30, perDay: 2 }, steps: { total: 60000, perDay: 4000 }, min: { total: 600, perDay: 30 },
};
