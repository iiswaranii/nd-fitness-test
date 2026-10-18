import { parseStravaStats, type ScreenshotStats } from './stravaText';

/**
 * Reads distance and time from a Strava screenshot, on the phone (no server, no fees).
 * The text-reading engine (~6 MB, served with the app) downloads on first use; the browser caches it.
 */
export async function readStravaScreenshot(file: File, onProgress?: (pct: number) => void): Promise<ScreenshotStats & { text: string }> {
  const img = await prepare(file);
  const { createWorker } = await import('tesseract.js');
  // Engine and English data are served with the app (public/ocr), so nothing depends on a third-party CDN.
  const base = new URL(import.meta.env.BASE_URL + 'ocr/', location.href).href;
  const worker = await createWorker('eng', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base,
    langPath: base,
    gzip: true,
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100)); },
  });
  try {
    const { data } = await worker.recognize(img);
    return { ...parseStravaStats(data.text), text: data.text };
  } finally {
    await worker.terminate();
  }
}

/** Grey, high-contrast, dark text on light: Strava's dark mode reads much better inverted. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(2, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const dark = sum / (d.length / 4) < 110;
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (dark) g = 255 - g;
    g = g < 150 ? Math.max(0, g - 40) : 255; // push text darker and background white
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}
