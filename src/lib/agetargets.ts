import type { Challenge } from './types';
import { ageOn } from './audience';
import type { DistUnit } from './units';

/**
 * Age-wise targets. An admin can give each age group its own target, e.g. water: 50–60 → 2,000 ml a day.
 * value = the daily target for a habit, the overall target (km, days or sessions) for exercise.
 * Ranges are inclusive; an empty side means no limit. Members outside every range (or without a birthday)
 * get the challenge's normal target. A member's group is fixed by their age on the challenge's start date.
 */
/**
 * Exercise: on "Total" goals value is the group's total; on "Active days" goals value is what counts as an
 * active day for that group (e.g. 10,000 steps). unit: the group's own unit (steps while the challenge is in km).
 */
export type AgeTarget = { min: number | null; max: number | null; value: number; unit?: DistUnit };

export const ageRangeText = (t: Pick<AgeTarget, 'min' | 'max'>) =>
  t.min !== null && t.max !== null ? `${t.min}–${t.max}` : t.min !== null ? `${t.min}+` : t.max !== null ? `up to ${t.max}` : 'all ages';

export function bandFor(c: Pick<Challenge, 'age_targets' | 'start_date'>, dob: string | null | undefined): number | null {
  const ts = c.age_targets ?? [];
  if (!ts.length || !dob) return null;
  const [y, m, d] = c.start_date.split('-').map(Number);
  const age = ageOn(dob, new Date(y, m - 1, d));
  if (age === null) return null;
  const i = ts.findIndex((t) => (t.min === null || age >= t.min) && (t.max === null || age <= t.max));
  return i < 0 ? null : i;
}

/** The challenge as this member sees it: their age group's target in place of the normal one. */
export function withBand(c: Challenge, band: number | null | undefined): Challenge {
  const base: Challenge = { ...c, base_target: c.base_target ?? c.target, base_daily_target: c.base_daily_target !== undefined ? c.base_daily_target : c.daily_target, base_unit: c.base_unit !== undefined ? c.base_unit : c.unit ?? null };
  const t = band === null || band === undefined ? null : c.age_targets?.[band];
  const dm = c.base_daily_min !== undefined ? c.base_daily_min : c.daily_min;
  if (!t) return { ...base, target: base.base_target!, daily_target: base.base_daily_target ?? null, unit: base.base_unit, daily_min: dm, base_daily_min: dm, my_band: null };
  return c.category === 'habit'
    ? { ...base, daily_target: t.value, target: base.base_target!, unit: base.base_unit, my_band: band! }
    : c.metric === 'days'
      // Active days: the group changes how much counts as an active day (e.g. 10,000 steps), not the number of days.
      ? { ...base, target: base.base_target!, daily_min: t.value, base_daily_min: c.base_daily_min !== undefined ? c.base_daily_min : c.daily_min, daily_target: base.base_daily_target ?? null, unit: t.unit ?? base.base_unit, my_band: band! }
      : { ...base, target: t.value, daily_target: base.base_daily_target ?? null, unit: c.metric === 'distance' && t.unit ? t.unit : base.base_unit, my_band: band! };
}

/** The normal target, ignoring age groups (what admins see as the default). */
export const baseOf = (c: Challenge): Challenge => withBand(c, null);

/** Do the age groups measure in different units? Then leaderboards compare % of each member's own goal. */
export const mixedUnits = (c: Challenge) => c.category === 'activity' && (c.metric === 'distance' || c.metric === 'days')
  && !!c.age_targets?.some((t) => t.unit && t.unit !== (c.base_unit !== undefined ? c.base_unit ?? 'km' : c.unit ?? 'km'));
