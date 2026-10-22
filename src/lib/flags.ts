import { COUNTRIES } from './validation';

/** Country name (as saved in the profile, e.g. "India") → flag emoji (🇮🇳). Empty when unknown. */
const byName = new Map<string, string>();
let built = false;
function build() {
  if (built) return;
  built = true;
  COUNTRIES.forEach((c) => byName.set(c.name.toLowerCase(), c.code));
  try {
    // Names the browser knows too (United Kingdom, United States, …), so spelling differences still match.
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const n = dn.of(code);
      if (n && n !== code && !byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), code);
    }
  } catch { /* older browsers: the built-in list is enough */ }
  [['usa', 'US'], ['uk', 'GB'], ['england', 'GB'], ['uae', 'AE'], ['america', 'US']].forEach(([n, c]) => byName.set(n, c));
}

export function flagOf(country: string | null | undefined): string {
  if (!country) return '';
  build();
  const t = country.trim();
  const code = /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : byName.get(t.toLowerCase());
  if (!code) return '';
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
