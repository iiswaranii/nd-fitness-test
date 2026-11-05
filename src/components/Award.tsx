import { useMemo } from 'react';
import { awardFor } from '../lib/award';
import { lookOf } from '../lib/look';
import type { Challenge } from '../lib/types';

/** The trophy for a place (1–3) in a challenge: its shape and colour come from the challenge's activity. */
export function Award({ c, place, size = 64, stand = true }: { c: Challenge; place: number; size?: number; stand?: boolean }) {
  const svg = useMemo(() => awardFor(c, place, lookOf(c).icon, { stand }), [c, place, stand]);
  return <span className="aw-art" style={{ width: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
