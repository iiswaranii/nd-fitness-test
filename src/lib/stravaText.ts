/**
 * Pulls distance and time out of the text of a Strava screenshot (read on the phone by OCR).
 * Strava shows a grid such as:
 *   Distance      Pace          Moving Time        or   Distance 4.25 km   Time 52m 10s
 *   4.25 km       12:16 /km     52m 10s
 * Labels and values may come out on different lines, so we look for value shapes, not positions.
 */
export type ScreenshotStats = { km: number | null; seconds: number | null };

const clean = (t: string) =>
  t.replace(/[|]/g, ' ')
    .replace(/(\d)\s*[,](\d{1,2})(?!\d)/g, '$1.$2') // 4,25 km → 4.25 km
    .replace(/[“”"']/g, '')
    .replace(/\bO(?=\d)|(?<=\d)O\b/g, '0')          // OCR: O ↔ 0 next to digits
    .replace(/[ \t]+/g, ' ');

function toSeconds(s: string): number | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = t.match(/^(\d{1,3}):(\d{2})$/);
  if (m) return +m[1] * 60 + +m[2];
  const h = t.match(/(\d+)\s*h/i), mi = t.match(/(\d+)\s*m(?!i)/i), sec = t.match(/(\d+)\s*s/i);
  if (!h && !mi && !sec) return null;
  return (h ? +h[1] * 3600 : 0) + (mi ? +mi[1] * 60 : 0) + (sec ? +sec[1] : 0);
}

const LABELS = ['moving time', 'elapsed time', 'elevation gain', 'elev gain', 'avg speed', 'avg pace', 'avg heart rate', 'distance', 'pace', 'time', 'speed', 'steps', 'calories', 'elevation'];
const LABEL_RE = new RegExp(`\\b(${LABELS.join('|')})\\b`, 'gi');
const VALUE_RE = /(\d{1,2}h\s*\d{1,2}m(?:\s*\d{1,2}s)?|\d{1,3}m\s*\d{1,2}s|\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2}(?:\s*\/\s*(?:km|mi))?|\d[\d.,]*\s*(?:km\/h|mi\/h|km|mi|bpm|cal|ft|m(?![a-z]))?)/gi;

/** Strava's stat grid: a row of labels, then a row of values in the same order. */
function fromGrid(text: string): ScreenshotStats {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: ScreenshotStats = { km: null, seconds: null };
  for (let i = 0; i < lines.length - 1; i++) {
    const labels = [...lines[i].matchAll(LABEL_RE)].map((m) => m[1].toLowerCase());
    if (labels.length < 2) continue;
    const values = [...lines[i + 1].matchAll(VALUE_RE)].map((m) => m[1].trim()).filter((v) => /\d/.test(v));
    if (values.length !== labels.length) continue;
    labels.forEach((l, j) => {
      const v = values[j];
      if (l === 'distance' && out.km === null) {
        const m = v.match(/^([\d.]+)\s*(km|mi)?/i);
        if (m) out.km = m[2]?.toLowerCase() === 'mi' ? +(parseFloat(m[1]) * 1.609344).toFixed(2) : parseFloat(m[1]);
      }
      if ((l === 'moving time' || ((l === 'elapsed time' || l === 'time') && out.seconds === null))) {
        const sec = toSeconds(v.replace(/\s*\/.*$/, ''));
        if (sec && sec >= 60) out.seconds = sec;
      }
    });
  }
  return out;
}

export function parseStravaStats(raw: string): ScreenshotStats {
  const text = clean(raw);
  const grid = fromGrid(text);
  if (grid.km !== null && grid.seconds !== null) return grid;

  // Distance: a number followed by km / mi that isn't a pace ("/km"). Prefer one near the word Distance.
  let km: number | null = null;
  const distRe = /(\d{1,3}(?:\.\d{1,2})?)\s*(km|mi)\b(?!\s*\/)/gi;
  const dists = [...text.matchAll(distRe)].filter((m) => text[(m.index ?? 0) - 1] !== '/');
  const di = text.search(/distance/i);
  const pick = di >= 0 ? dists.find((m) => (m.index ?? 0) > di) ?? dists[0] : dists[0];
  if (pick) {
    const n = parseFloat(pick[1]);
    km = pick[2].toLowerCase() === 'mi' ? +(n * 1.609344).toFixed(2) : n;
  }
  if (km === null) {
    // "Distance" line followed by a bare number (unit on its own line)
    const m = text.match(/distance[^\d]{0,20}(\d{1,3}\.\d{1,2})/i);
    if (m) km = parseFloat(m[1]);
  }

  // Time: prefer the value after "Moving Time", then "Elapsed Time"/"Time". Skip paces (mm:ss /km).
  const timeRe = /(\d{1,2}h\s*\d{1,2}m(?:\s*\d{1,2}s)?|\d{1,3}m\s*\d{1,2}s|\d{1,2}h|\d{1,3}m(?!i)|\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})(?!\s*\/)/gi;
  const times = [...text.matchAll(timeRe)].filter((m) => {
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 4);
    return !/^\s*\//.test(after) && !/^\s*(am|pm)/i.test(after);
  });
  const anchor = ['moving time', 'elapsed time', 'time'].map((w) => text.toLowerCase().indexOf(w)).find((i) => i >= 0) ?? -1;
  const candidates = anchor >= 0 ? times.filter((m) => (m.index ?? 0) > anchor) : times;
  let seconds: number | null = grid.seconds;
  const hasPace = /\bpace\b/i.test(text);
  const pool = (candidates.length ? candidates : times).slice().sort((a, b) => {
    const rank = (x: string) => (hasPace && /^\d{1,3}:\d{2}$/.test(x) ? 1 : 0);
    return rank(a[1]) - rank(b[1]);
  });
  for (const m of seconds ? [] : pool) {
    const s = toSeconds(m[1]);
    if (s && s >= 60 && s <= 24 * 3600) { seconds = s; break; }
  }
  if (grid.km !== null) km = grid.km;
  return { km: km && km > 0 && km < 400 ? km : null, seconds };
}
