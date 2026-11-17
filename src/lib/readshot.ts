import type { Sport } from './types';
import { addDays, today } from './dates';

/**
 * Reads a screenshot of any fitness app (Strava, Google Fit, Samsung Health, Apple Health / Fitness, Mi Fitness,
 * Zepp / Amazfit, Fitbit, Garmin, Noise, boAt, Huawei Health…) on the phone itself and picks out steps, distance,
 * time and the day. Nothing is uploaded: the text recogniser runs in the browser. The member always checks the
 * numbers before saving.
 *
 * Apps lay numbers out in three ways, all handled here:
 *   "8,432 steps"  ·  "Steps\n8,432" (label above)  ·  "Distance  Steps  Time\n5.61 km  7,596  1h 6m" (columns)
 */
export type ShotGuess = { steps: number | null; km: number | null; minutes: number | null; sport: Sport | null; date: string | null; text: string };

const LABEL: [RegExp, 'steps' | 'km' | 'time' | 'other'][] = [
  [/^(steps?|step count|total steps|कदम)$/i, 'steps'],
  [/^(distance|dist\.?|दूरी)$/i, 'km'],
  [/^(time|duration|moving time|elapsed time|active time|workout time|total time|exercise time|समय)$/i, 'time'],
  [/^(calories|kcal|cal|active calories|energy|pace|avg\.? pace|average pace|speed|avg\.? speed|elev\.?(ation)?( gain)?|heart rate|avg\.? hr|bpm|cadence|floors|move|exercise|stand)$/i, 'other'],
];
const labelOf = (w: string) => LABEL.find(([re]) => re.test(w.trim()))?.[1] ?? null;
// One value: "1h 6m", "1:06:12", "45:10", "5.61 km", "7,596", "320 kcal"
const VALUE = /(\d{1,2}\s*h(?:r|rs|ours?)?\s*\d{1,2}\s*m(?:in|ins)?\b|\d{1,2}\s*h(?:r|rs|ours?)?\b|\d{1,3}\s*m(?:in|ins)\b|\d{1,2}:\d{2}(?::\d{2})?|\d[\d,.]*\s*(?:km|kms|mi|miles|m|kcal|cal|bpm|\/km)?)/gi;

function minutesOf(v: string): number | null {
  let m = v.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return +m[1] * 60 + +m[2] + +m[3] / 60;
  m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return +m[1] + +m[2] / 60;   // mm:ss on most workout screens
  const h = v.match(/(\d+)\s*h/i), mi = v.match(/(\d+)\s*m(?!i\b|iles)/i);
  if (h || mi) return (h ? +h[1] * 60 : 0) + (mi ? +mi[1] : 0);
  return null;
}
function kmOf(v: string, steps: number | null): number | null {
  const m = v.match(/^(\d[\d.,]*)\s*(km|kms|mi|miles)?$/i);
  if (!m) return null;
  let raw = m[1];
  if (/^\d+,\d{1,2}$/.test(raw)) raw = raw.replace(',', '.');    // decimal comma
  let n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  // OCR sometimes drops the decimal point ("5.91 km" → "591km"). Put it back where it makes sense.
  if (!/[.,]/.test(m[1]) && n >= 100) {
    const cands = [n / 100, n / 10];
    const fromSteps = steps ? steps / 1300 : null;
    n = fromSteps ? cands.reduce((a, b) => (Math.abs(b - fromSteps) < Math.abs(a - fromSteps) ? b : a)) : cands[0];
  }
  if (m[2] && /^mi/i.test(m[2])) n *= 1.609344;
  return n > 0 && n < 400 ? n : null;
}
const stepsOf = (v: string) => { if (/[a-z:]/i.test(v.replace(/steps?/i, ''))) return null; const n = Number(v.replace(/\D/g, '')); return n >= 10 && n <= 100000 ? n : null; };

function dateOf(t: string): string | null {
  const td = today();
  if (/\btoday\b/i.test(t)) return td;
  if (/\byesterday\b/i.test(t)) return addDays(td, -1);
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const year = Number(td.slice(0, 4));
  const fit = (mo: number, d: number) => {
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    let y = year; let s = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (s > td) { y -= 1; s = `${y}-${s.slice(5)}`; }
    return s >= addDays(td, -7) ? s : null;     // only the last 7 days can be added
  };
  let m = t.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
  if (m) return fit(MON.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i);
  if (m) return fit(MON.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (m) return fit(+m[2], +m[1]);           // dd/mm, as phones in India show it
  return null;
}

export function parseFitnessText(raw: string): ShotGuess {
  // OCR often reads "O" for 0 and "l" for 1 inside numbers.
  const t = raw.replace(/(?<=\d)[Oo](?=\d)/g, '0').replace(/(?<=\d)[lI](?=\d)/g, '1').replace(/\u00a0/g, ' ')
    .replace(/(?<=\d\s?h\s?)[éèbG](?=\s?m)/g, '6').replace(/(?<=\d\s?h\s?)[S§](?=\s?m)/g, '5');   // OCR: "1hém" → "1h6m"
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let steps: number | null = null, km: number | null = null, minutes: number | null = null;
  const put = (kind: string, v: string) => {
    if (kind === 'steps' && steps === null) steps = stepsOf(v);
    else if (kind === 'km' && km === null) km = kmOf(v, steps);
    else if (kind === 'time' && minutes === null) minutes = minutesOf(v);
  };

  // 1. columns: a line of labels, then a line of values in the same order
  for (let i = 0; i < lines.length - 1; i++) {
    const words = lines[i].split(/\s{2,}|\s*[|·•]\s*|\s+(?=(?:distance|steps?|time|duration|calories|pace|elev|speed|kcal)\b)/i).map((w) => w.trim()).filter(Boolean);
    const kinds = words.map(labelOf);
    if (kinds.filter(Boolean).length < 2 || kinds.some((k) => k === null)) continue;
    for (const next of [lines[i + 1], lines[i + 2]]) {
      if (!next) continue;
      const vals = next.match(VALUE)?.map((v) => v.trim()) ?? [];
      if (vals.length >= kinds.length) { kinds.forEach((k, j) => put(k!, vals[j])); break; }
    }
  }
  // 2. label next to or above its value
  for (let i = 0; i < lines.length; i++) {
    const lm = lines[i].match(/^(steps?|step count|total steps|distance|time|duration|moving time|active time|workout time|elapsed time)\b[:\s]*(.*)$/i);
    if (!lm) continue;
    const kind = labelOf(lm[1])!;
    // steps can be written with spaces as thousands separators ("12 045"), so read the whole number
    const pick = (x: string) => (kind === 'steps' ? x.match(/\d{1,3}(?:[ ,.]\d{3})+|\d+/)?.[0] : x.match(VALUE)?.[0]?.trim());
    const cand = [lm[2], lines[i + 1] ?? ''].map(pick).find(Boolean);
    if (cand) put(kind, cand);
  }
  // 3. value with its unit: "8,432 steps", "5.2 km", "1 h 12 min", "1:02:33"
  if (steps === null) { const m = t.match(/(\d{1,3}(?:[,.\s]\d{3})+|\d{2,6})\s*(?:steps?|stp|कदम)\b/i); if (m) steps = stepsOf(m[1]); }
  if (km === null) { const m = t.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(km|kms|kilomet(?:er|re)s?|mi|miles?)\b/i); if (m) km = kmOf(`${m[1]} ${m[2].toLowerCase().startsWith('mi') ? 'mi' : 'km'}`, steps); }
  if (minutes === null) {
    const m = t.match(/\b(\d{1,2}:\d{2}:\d{2})\b/) ?? t.match(/\b(\d{1,2}\s*(?:h|hr|hrs|hours?)\s*\d{1,2}\s*(?:m|min|mins|minutes?))\b/i) ?? t.match(/\b(\d{1,3}\s*(?:min|mins|minutes))\b/i);
    if (m) minutes = minutesOf(m[1].replace(/minutes?|mins/i, 'm').replace(/hours?|hrs|hr/i, 'h'));
  }
  // 4. a big number on a screen that talks about steps (e.g. a ring with "7,596" in the middle)
  if (steps === null && /\bsteps?\b|कदम/i.test(t)) {
    const nums = [...t.matchAll(/(?<![\d.:])(\d{1,3}(?:,\d{3})+|\d{3,5})(?![\d.:]|\s*(?:kcal|cal|km|mi|m\b|bpm|%))/gi)].map((m) => Number(m[1].replace(/,/g, ''))).filter((n) => n >= 100 && n <= 100000 && !(n >= 1990 && n <= 2100));
    if (nums.length) steps = Math.max(...nums);
  }
  // a lone "28:41" on a workout screen is the duration (not a clock time, not a pace per km)
  if (minutes === null && km !== null) {
    const body = lines.slice(1).join('\n');   // the first line is usually the phone's status-bar clock
    const m = [...body.matchAll(/(?<![\d:])(\d{1,2}:\d{2})(?![\d:])(?!\s*(?:am|pm|\/\s*(?:km|mi)))/gi)].find((x) => !/(pace|at)\s*$/i.test(body.slice(Math.max(0, x.index! - 12), x.index)));
    if (m) minutes = minutesOf(m[1]);
  }
  if (minutes !== null && (minutes <= 0 || minutes > 1440)) minutes = null;

  const sport: Sport | null = /\b(cycl|bike|biking|ride|riding)/i.test(t) ? 'ride' : /\b(run|running|jog)/i.test(t) ? 'run' : /\b(walk|walking|steps|hike|hiking)/i.test(t) ? 'walk' : null;
  const k = km as number | null, mn = minutes as number | null;
  return { steps, km: k === null ? null : Math.round(k * 100) / 100, minutes: mn === null ? null : Math.round(mn), sport, date: dateOf(t), text: t };
}

/** Recognise the text in an image file (in the browser). Loads the recogniser the first time (~7 MB, then cached). */
export async function readScreenshot(file: File, onProgress?: (p: number) => void): Promise<ShotGuess> {
  const { createWorker } = await import('tesseract.js');
  // Everything the recogniser needs is served by the app itself (public/ocr), not from another site.
  const dir = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href;
  const worker = await createWorker('eng', 1, {
    workerPath: dir + 'worker.min.js', corePath: dir, langPath: dir, gzip: true, workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(await upscale(file));
    return parseFitnessText(data.text || '');
  } finally {
    await worker.terminate();
  }
}

/** Small or compressed screenshots read better a little larger. */
async function upscale(file: File): Promise<File | HTMLCanvasElement> {
  try {
    const bmp = await createImageBitmap(file);
    if (bmp.width >= 1000) return file;
    const k = Math.min(3, 1200 / bmp.width);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  } catch { return file; }
}
