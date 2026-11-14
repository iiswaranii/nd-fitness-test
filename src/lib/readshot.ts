import type { Sport } from './types';

/**
 * Reads a screenshot of a fitness app (Google Fit, Samsung Health, Apple Health / Fitness, Mi Fit, Fitbit…)
 * on the phone itself and picks out steps, distance and time. Nothing is uploaded: the text recogniser runs
 * in the browser. The member always checks the numbers before saving.
 */
export type ShotGuess = { steps: number | null; km: number | null; minutes: number | null; sport: Sport | null; text: string };


export function parseFitnessText(raw: string): ShotGuess {
  // OCR often reads "O" for 0 and "l" for 1 inside numbers, and splits thousands with a space or a dot.
  const text = raw.replace(/(?<=\d)[Oo](?=\d)/g, '0').replace(/(?<=\d)[lI](?=\d)/g, '1');
  const t = text.replace(/ /g, ' ');

  // ---- steps: "8,432 steps", "Steps 8432", "8432\nsteps", "कदम"
  let steps: number | null = null;
  const stepRes = [
    /(\d{1,3}(?:[,.\s]\d{3})+|\d{2,6})\s*(?:steps?|stp|कदम)\b/i,
    /(?:steps?|कदम)\s*[:\n]?\s*(\d{1,3}(?:[,.\s]\d{3})+|\d{2,6})/i,
  ];
  for (const re of stepRes) { const m = t.match(re); if (m) { const v = Number(m[1].replace(/\D/g, "")); if (v >= 10 && v <= 100000) { steps = v; break; } } }

  // ---- distance: "5.2 km", "5,2 km", "3.1 mi"
  let km: number | null = null;
  const d = t.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(km|kilomet(?:er|re)s?|mi|miles?)\b/i);
  if (d) {
    let v = Number(d[1].replace(',', '.'));
    // OCR sometimes drops the decimal point ("5.91 km" → "591km"). Put it back where it makes sense.
    if (!/[.,]/.test(d[1]) && v >= 100) {
      const cands = [v / 100, v / 10];
      const fromSteps = steps ? steps / 1300 : null;
      v = fromSteps ? cands.reduce((a, b) => (Math.abs(b - fromSteps) < Math.abs(a - fromSteps) ? b : a)) : cands[0];
    }
    if (v > 0 && v < 400) km = /^mi/i.test(d[2]) ? v * 1.609344 : v;
  }

  // ---- time: "1:02:33", "45:10", "1 h 5 min", "1h 05m", "52 min"
  let minutes: number | null = null;
  const hms = t.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  const hm = t.match(/(\d{1,2})\s*(?:h|hr|hrs|hours?)\s*(\d{1,2})\s*(?:m|min|mins|minutes?)\b/i);
  const mOnly = t.match(/\b(\d{1,3})\s*(?:min|mins|minutes)\b/i);
  const ms = t.match(/\b(\d{1,2}):(\d{2})\b(?!\s*(?:am|pm|AM|PM))/);
  if (hms) minutes = +hms[1] * 60 + +hms[2] + +hms[3] / 60;
  else if (hm) minutes = +hm[1] * 60 + +hm[2];
  else if (mOnly) minutes = +mOnly[1];
  else if (ms && km) minutes = +ms[1] + +ms[2] / 60;   // "45:10" next to a distance is usually the duration
  if (minutes !== null && (minutes <= 0 || minutes > 1440)) minutes = null;

  // ---- what kind of activity
  const sport: Sport | null = /\b(cycl|bike|biking|ride|riding)/i.test(t) ? 'ride' : /\b(run|running|jog)/i.test(t) ? 'run' : /\b(walk|walking|steps|hike)/i.test(t) ? 'walk' : null;

  return { steps, km: km === null ? null : Math.round(km * 100) / 100, minutes: minutes === null ? null : Math.round(minutes), sport, text: t };
}

/** Recognise the text in an image file (in the browser). Loads the recogniser the first time (~a few MB). */
export async function readScreenshot(file: File, onProgress?: (p: number) => void): Promise<ShotGuess> {
  const { createWorker } = await import('tesseract.js');
  // Everything the recogniser needs is served by the app itself (public/ocr), not from another site.
  const dir = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href;
  const worker = await createWorker('eng', 1, {
    workerPath: dir + 'worker.min.js', corePath: dir, langPath: dir, gzip: true, workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(file);
    return parseFitnessText(data.text || '');
  } finally {
    await worker.terminate();
  }
}
