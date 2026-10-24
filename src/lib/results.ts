import type { Challenge, Participant } from './types';
import { endClock } from './progress';

/** This phone's time zone, e.g. "Asia/Kolkata". */
export const myTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

/** Used only when a member's phone time zone isn't known yet: the zone in that country that finishes last. */
const COUNTRY_LAST_TZ: Record<string, string> = {
  India: 'Asia/Kolkata', 'United States': 'America/Los_Angeles', Canada: 'America/Vancouver', 'United Kingdom': 'Europe/London',
  Australia: 'Australia/Perth', 'New Zealand': 'Pacific/Auckland', Thailand: 'Asia/Bangkok', Nepal: 'Asia/Kathmandu',
  'United Arab Emirates': 'Asia/Dubai', Singapore: 'Asia/Singapore', Malaysia: 'Asia/Kuala_Lumpur', Kenya: 'Africa/Nairobi',
  Germany: 'Europe/Berlin', France: 'Europe/Paris', Italy: 'Europe/Rome', Netherlands: 'Europe/Amsterdam', Spain: 'Europe/Madrid',
  Pakistan: 'Asia/Karachi', Bangladesh: 'Asia/Dhaka', 'Sri Lanka': 'Asia/Colombo', Fiji: 'Pacific/Fiji', Ireland: 'Europe/Dublin',
};

function offsetMinutes(tz: string, t: number): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t) / 60000;
}

/** The exact moment (ms) when a local date + "HH:MM" happens in a time zone (end of that minute). */
export function zonedEnd(date: string, hhmm: string, tz: string): number | null {
  try {
    const [y, m, d] = date.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
    const guess = Date.UTC(y, m - 1, d, h, mi, 59);
    let t = guess - offsetMinutes(tz, guess) * 60000;
    const again = guess - offsetMinutes(tz, t) * 60000; // daylight-saving edge
    if (again !== t) t = again;
    return t;
  } catch { return null; }
}

const tzOf = (p: Pick<Participant, 'tz' | 'country'>) => p.tz || (p.country ? COUNTRY_LAST_TZ[p.country] : undefined);

export type Results = {
  /** When results are final: the moment the last member's final day ends. */
  at: number;
  /** Everyone has finished: show final standings and trophies. */
  final: boolean;
  /** Members are in more than one time zone (only then do we explain the wait). */
  spread: boolean;
  /** Countries still on their last day (for the message). */
  stillGoing: string[];
};

export function resultsOf(c: Challenge, ps: Pick<Participant, 'tz' | 'country'>[], now = Date.now()): Results {
  const mine = myTz();
  const end = endClock(c);
  const zones = new Map<string, string | null>(); // tz → a country name
  for (const p of ps) { const z = tzOf(p) ?? mine; if (!zones.has(z) || (!zones.get(z) && p.country)) zones.set(z, p.country ?? null); }
  if (!zones.size) zones.set(mine, null);
  let at = 0;
  const ends: [number, string | null][] = [];
  for (const [z, country] of zones) { const t = zonedEnd(c.end_date, end, z); if (t !== null) { ends.push([t, country]); at = Math.max(at, t); } }
  if (!at) at = zonedEnd(c.end_date, end, mine) ?? now;
  const stillGoing = [...new Set(ends.filter(([t, country]) => t > now && country).map(([, country]) => country as string))];
  const offsets = new Set(ends.map(([t]) => t));
  return { at, final: now > at, spread: offsets.size > 1, stillGoing };
}
