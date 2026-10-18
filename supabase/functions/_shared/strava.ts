// Reads a Strava activity from its public embed page (strava-embeds.com), the same page Strava's
// own "Share → Embed" uses. No Strava login, API key or connection needed. The activity must be
// visible to Everyone, or the member pastes the embed code, which carries a token.
//
// Pure functions only (no Deno APIs), so the parser can be tested with Node.

export type Sport = 'walk' | 'run' | 'ride';

export type Parsed = {
  athleteId: string | null;
  athleteName: string | null;
  sportType: string | null;
  sport: Sport | null;
  title: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM:SS when shown ("Today at 7:32 AM")
  distanceM: number | null;
  seconds: number | null;
  elevM: number | null;
};

/** Strava sport names we count, mapped to our three sports. Everything else is ignored. */
const SPORTS: [RegExp, Sport][] = [
  [/^(walk|hike)$/i, 'walk'],
  [/^(run|trail run|virtual run|treadmill run)$/i, 'run'],
  [/^(ride|gravel ride|mountain bike ride|e-?bike ride|e-?mountain bike ride|virtual ride|velomobile|indoor ride|commute ride)$/i, 'ride'],
];
const OTHER_SPORTS = /^(swim|workout|weight training|yoga|elliptical|stair-?stepper|rowing|ski|alpine ski|nordic ski|snowboard|rock climb|kayaking|canoeing|surfing|tennis|football \(soccer\)|soccer|golf|crossfit|hiit|pilates|badminton|cricket|squash|table tennis|wheelchair|handcycle|inline skate|skateboard|ice skate|sail|stand up paddling|windsurf|kitesurf|snowshoe|rock climbing|virtual row)$/i;

export function sportOf(type: string | null): Sport | null {
  if (!type) return null;
  for (const [re, s] of SPORTS) if (re.test(type.trim())) return s;
  return null;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const monthNo = (m: string) => MONTHS.findIndex((x) => x.startsWith(m.toLowerCase().slice(0, 3))) + 1;
const pad = (n: number) => String(n).padStart(2, '0');

function decode(s: string): string {
  return s
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&bull;|&#8226;/g, '•')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** HTML → trimmed text lines (one per element). */
export function textLines(html: string): string[] {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<head[\s\S]*?<\/head>/i, '\n')
    .replace(/<[^>]+>/g, '\n');
  return decode(body).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const num = (v: string) => {
  // "1,234.5" → 1234.5 · "7,0" (decimal comma) → 7.0
  const t = v.trim();
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return parseFloat(t.replace(/,/g, ''));
  if (/^\d+,\d{1,2}$/.test(t)) return parseFloat(t.replace(',', '.'));
  return parseFloat(t.replace(/\s/g, ''));
};

/** "1h 47m", "47m 12s", "1:47:03", "35:10", "52s" → seconds */
export function parseDuration(v: string): number | null {
  const t = v.trim();
  let m = t.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = t.match(/^(\d+):(\d{2})$/);
  if (m) return +m[1] * 60 + +m[2];
  const h = t.match(/(\d+)\s*h/), mi = t.match(/(\d+)\s*m(?!i)/), s = t.match(/(\d+)\s*s/);
  if (!h && !mi && !s) return null;
  return (h ? +h[1] * 3600 : 0) + (mi ? +mi[1] * 60 : 0) + (s ? +s[1] : 0);
}

function parseDistance(value: string, unit: string): number | null {
  const n = num(value);
  if (!isFinite(n)) return null;
  const u = unit.toLowerCase();
  return Math.round(u === 'km' ? n * 1000 : u === 'mi' ? n * 1609.344 : u === 'm' ? n : u === 'yd' ? n * 0.9144 : n * 1000);
}

/** Pulls the value that follows a label, whether on the same line ("Distance 7.0 mi") or the next one. */
function after(lines: string[], label: RegExp, value: RegExp): RegExpMatchArray | null {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const lm = l.match(label);
    if (!lm) continue;
    const rest = l.slice((lm.index ?? 0) + lm[0].length).trim();
    const same = rest.match(value);
    if (same) return same;
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const m = lines[j].match(value);
      if (m) return m;
    }
  }
  return null;
}

/** Local "today" of the member (sent by the app), so "Today"/"Yesterday" resolve correctly. */
function shiftDay(ymd: string, d: number): string {
  const [y, m, dd] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd + d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function clock(h: string, m: string, ap?: string): string {
  let hh = +h;
  if (ap) { const pm = /p/i.test(ap); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
  return `${pad(hh)}:${pad(+m)}:00`;
}

export function parseEmbed(html: string, today: string): Parsed {
  const lines = textLines(html);
  const all = lines.join('\n');

  // Links are often wrapped (strava.app.link?...$fallback_url=https%3A%2F%2Fwww.strava.com%2Fathletes%2F123), so decode first.
  const hay = html.replace(/%2F/gi, '/').replace(/%3A/gi, ':');
  const athleteId = hay.match(/strava\.com\/athletes\/(\d+)/)?.[1] ?? hay.match(/strava:\/\/athletes\/(\d+)/)?.[1] ?? null;

  // Date: "July 28, 2024", "28 July 2024", "Today at 7:32 AM", "Yesterday at 18:05", "July 28, 2024 at 7:32 AM"
  let date: string | null = null, time: string | null = null, dateLine = -1;
  const reMDY = new RegExp(`\\b${MON}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
  const reDMY = new RegExp(`\\b(\\d{1,2})\\s+${MON}\\s+(\\d{4})`, 'i');
  const reRel = /\b(Today|Yesterday)\b/i;
  const reTime = /\bat\s+(\d{1,2}):(\d{2})\s*([AP]\.?M\.?)?/i;
  for (let i = 0; i < lines.length && !date; i++) {
    const l = lines[i];
    let m = l.match(reMDY);
    if (m) date = `${m[3]}-${pad(monthNo(m[1]))}-${pad(+m[2])}`;
    else if ((m = l.match(reDMY))) date = `${m[3]}-${pad(monthNo(m[2]))}-${pad(+m[1])}`;
    else if ((m = l.match(reRel)) && l.length < 40) date = /yesterday/i.test(m[1]) ? shiftDay(today, -1) : today;
    if (date) {
      dateLine = i;
      const t = l.match(reTime);
      if (t) time = clock(t[1], t[2], t[3]);
    }
  }

  // Sport type: a known sport name on its own line, nearest to (usually just before) the date.
  let sportType: string | null = null;
  const isSportLine = (l: string) => !!sportOf(l) || OTHER_SPORTS.test(l);
  const order = dateLine >= 0 ? [dateLine - 1, dateLine + 1, dateLine - 2, dateLine + 2] : [];
  for (const i of order) if (lines[i] && isSportLine(lines[i])) { sportType = lines[i]; break; }
  if (!sportType) sportType = lines.find(isSportLine) ?? null;
  if (!sportType) {
    // "View Name's Run on July 28, 2024" style descriptions
    const d = all.match(/'s\s+([A-Za-z -]{3,30}?)\s+on\s/);
    if (d && isSportLine(d[1])) sportType = d[1];
  }

  // Athlete name: the line before "Follow" / "•", else from "Name's Run".
  let athleteName: string | null = null;
  const fi = lines.findIndex((l) => /^(•\s*)?Follow$/i.test(l) || l === '•');
  if (fi > 0) {
    for (let j = fi - 1; j >= 0; j--) if (lines[j] !== '•' && !/^(follow|athlete profile)$/i.test(lines[j])) { athleteName = lines[j].replace(/\s*•$/, ''); break; }
  }
  if (!athleteName) athleteName = all.match(/View\s+(.+?)'s\s+[A-Za-z -]+\s+on\s/)?.[1] ?? null;

  // Title: the first line after the date that isn't a sport name or a stat label.
  let title: string | null = null;
  const STAT = /^(distance|time|moving time|elapsed time|elevation|elev gain|elevation gain|pace|avg pace|speed|avg speed|calories|steps|kudos|be the first.*|view on.*|follow|•)$/i;
  if (dateLine >= 0) {
    for (let j = dateLine + 1; j < Math.min(dateLine + 4, lines.length); j++) {
      if (!isSportLine(lines[j]) && !STAT.test(lines[j]) && !/^\d/.test(lines[j])) { title = lines[j]; break; }
    }
  }
  if (!title) title = html.match(/<title>([^<|]+)/i)?.[1]?.trim() ?? null;

  const dist = after(lines, /^Distance(?![a-z])/i, /^([\d.,]+)\s*(km|mi|m|yd)\b/i);
  const tm = after(lines, /^(Moving Time|Elapsed Time|Time)(?![a-z])/i, /^((?:\d+\s*[hms]\s*)+|\d+:\d{2}(?::\d{2})?)/i);
  const el = after(lines, /^Elev(?:ation)?(?:\s+Gain)?(?![a-z])/i, /^([\d.,]+)\s*(m|ft)\b/i);

  return {
    athleteId,
    athleteName,
    sportType,
    sport: sportOf(sportType),
    title,
    date,
    time,
    distanceM: dist ? parseDistance(dist[1], dist[2]) : null,
    seconds: tm ? parseDuration(tm[1]) : null,
    elevM: el ? Math.round(el[2].toLowerCase() === 'ft' ? num(el[1]) * 0.3048 : num(el[1])) : null,
  };
}

/** strava.app.link / stra.va share links → the activity id they point to. */
export async function resolveShortLink(url: string): Promise<string | null> {
  const u = new URL(url);
  if (!['strava.app.link', 'stra.va'].includes(u.hostname)) return null;
  let next = url;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(next, { redirect: 'manual', headers: { 'User-Agent': BROWSER_UA } });
    const loc = res.headers.get('location');
    const body = loc ? '' : await res.text();
    const hay = decodeURIComponent(loc ?? body);
    const found = hay.match(/strava\.com\/activities\/(\d{6,})/) ?? hay.match(/strava:\/\/activities\/(\d{6,})/);
    if (found) return found[1];
    if (!loc) return null;
    next = new URL(loc, next).toString();
  }
  return null;
}

export const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

export function embedUrl(id: string, token?: string | null): string {
  return `https://strava-embeds.com/activity/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

/** What a logged-out visitor can still see on strava.com/activities/<id>: title, type, date and athlete. */
export type PagePreview = { title: string | null; sportType: string | null; sport: Sport | null; date: string | null; athleteName: string | null; athleteId: string | null };

export function parseActivityPage(html: string): PagePreview | null {
  const meta = (p: string) => {
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
      const attr = (n: string) => tag.match(new RegExp(`\\b${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
      const key = attr('property') ?? attr('name');
      if (key && (key[1] ?? key[2]).toLowerCase() === p) { const c = attr('content'); if (c) return decode(c[1] ?? c[2]).trim(); }
    }
    return null;
  };
  const ogTitle = meta('og:title') ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null;
  const desc = meta('og:description') ?? meta('description');
  if (!ogTitle && !desc) return null;
  // "View Swaran Singh's Walk on October 15, 2026 | Strava"
  const d = desc?.match(new RegExp(`View\\s+(.+?)['’]s\\s+(.+?)\\s+on\\s+${MON}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'));
  const sportType = d ? d[2].trim() : null;
  const hay = html.replace(/%2F/gi, '/').replace(/%3A/gi, ':');
  return {
    title: ogTitle ? decode(ogTitle).replace(/\s*\|\s*Strava\s*$/i, '').trim() || null : null,
    athleteName: d ? d[1].trim() : null,
    sportType,
    sport: sportOf(sportType),
    date: d ? `${d[5]}-${pad(monthNo(d[3]))}-${pad(+d[4])}` : null,
    athleteId: hay.match(/strava\.com\/athletes\/(\d+)/)?.[1] ?? null,
  };
}
