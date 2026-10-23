/** Light / dark / follow the phone. Saved on this device; index.html applies it before the app paints. */
export type Theme = 'system' | 'light' | 'dark';
const KEY = 'ndf-theme';
const BAR = { light: '#F3F4F6', dark: '#0A0B0E' };

export function getTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme; else root.dataset.theme = t;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t === 'system' ? 'light dark' : t);
  // Status-bar colour: follow the choice, or the phone when "System".
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('data-media') ?? m.getAttribute('media') ?? '';
    if (!m.hasAttribute('data-media')) m.setAttribute('data-media', media);
    if (t === 'system') { m.setAttribute('media', media); m.setAttribute('content', media.includes('dark') ? BAR.dark : BAR.light); }
    else { m.removeAttribute('media'); m.setAttribute('content', BAR[t]); }
  });
}

export function setTheme(t: Theme) {
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
}
