import type { Challenge } from './types';
import { SPORTS } from './types';
import { groupOf, habitByKey } from './habits';

/** Colour and icon for a challenge: by sport, or by habit group. */
export function lookOf(c: Challenge): { color: string; icon: string; kind: string } {
  if (c.category === 'activity' && c.sport) {
    const s = SPORTS[c.sport];
    return { color: s.color, icon: s.icon, kind: s.name };
  }
  const h = habitByKey(c.habit_key);
  if (!h) return { color: 'var(--good)', icon: 'leaf', kind: 'Healthy habit' };
  const g = groupOf(h);
  const icon = h.key === 'water' || h.group === 'Hydration' ? 'drop' : g.icon;
  return { color: g.color, icon, kind: `${g.name} habit` };
}
