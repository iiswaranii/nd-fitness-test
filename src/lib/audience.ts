import type { Challenge } from './types';

export type Me = { dob: string | null; country: string | null; state: string | null };

export function ageOn(dob: string | null | undefined, on = new Date()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  let a = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) a--;
  return a;
}

export const hasAudience = (c: Pick<Challenge, 'aud_min_age' | 'aud_max_age' | 'aud_countries' | 'aud_states'>) =>
  c.aud_min_age !== null || c.aud_max_age !== null || !!c.aud_countries?.length || !!c.aud_states?.length;

/** Is this member in the challenge's audience? Challenges with no audience are for everyone. */
export function matches(c: Challenge, me: Me): boolean {
  if (!hasAudience(c)) return true;
  if (c.aud_min_age !== null || c.aud_max_age !== null) {
    const a = ageOn(me.dob);
    if (a === null) return false;
    if (c.aud_min_age !== null && a < c.aud_min_age) return false;
    if (c.aud_max_age !== null && a > c.aud_max_age) return false;
  }
  if (c.aud_countries?.length && !c.aud_countries.includes(me.country ?? '')) return false;
  if (c.aud_states?.length && !c.aud_states.includes(me.state ?? '')) return false;
  return true;
}

/** "Ages 60+ · Punjab", for admin lists and the member's detail page. */
export function audienceText(c: Pick<Challenge, 'aud_min_age' | 'aud_max_age' | 'aud_countries' | 'aud_states'>): string {
  const parts: string[] = [];
  const lo = c.aud_min_age, hi = c.aud_max_age;
  if (lo !== null && hi !== null) parts.push(`Ages ${lo}–${hi}`);
  else if (lo !== null) parts.push(`Ages ${lo}+`);
  else if (hi !== null) parts.push(`Up to age ${hi}`);
  if (c.aud_states?.length) parts.push(c.aud_states.length <= 2 ? c.aud_states.join(', ') : `${c.aud_states.length} states`);
  else if (c.aud_countries?.length) parts.push(c.aud_countries.length <= 2 ? c.aud_countries.join(', ') : `${c.aud_countries.length} countries`);
  return parts.length ? parts.join(' · ') : 'Everyone';
}

export const AGE_BANDS = ['Under 18', '18–29', '30–44', '45–59', '60–74', '75+'] as const;
export function ageBand(age: number | null): string {
  if (age === null) return 'Not given';
  if (age < 18) return 'Under 18';
  if (age < 30) return '18–29';
  if (age < 45) return '30–44';
  if (age < 60) return '45–59';
  if (age < 75) return '60–74';
  return '75+';
}
