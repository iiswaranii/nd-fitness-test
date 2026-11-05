/**
 * Awards: enamel medallions with a polished metal rim, in the spirit of Apple Fitness awards.
 * Each activity has its own shape and colour so a shelf full of them looks varied:
 *   walk → rounded hexagon, orange · run → shield, pink · ride → circle, blue · habit → rounded diamond, green
 * The rim's metal is the place: gold (1st), silver (2nd), bronze (3rd). Badges use the coin form (no stand).
 * Pure SVG strings so the same artwork works in the app and on the presentation page.
 */
import { ICON_PATHS } from '../components/Icon';

export type AwardKind = 'walk' | 'run' | 'ride' | 'habit' | 'coin';
export type Metal = 'gold' | 'silver' | 'bronze' | 'steel';

const METALS: Record<Metal, [string, string, string, string]> = {
  //       light       mid         dark        engraving
  gold:   ['#FFF4C2', '#F2C14E', '#A86F0E', '#5E3D00'],
  silver: ['#FFFFFF', '#D3D9E2', '#7C8796', '#3B4350'],
  bronze: ['#FFDCC0', '#D08A52', '#7E4418', '#4A2307'],
  steel:  ['#E8ECF2', '#9AA3B0', '#4C5562', '#262B33'],
};
export const ENAMELS: Record<string, [string, string]> = {
  walk: ['#FFB25B', '#E8590C'],
  run: ['#FF7FB0', '#C2185B'],
  ride: ['#6FD0FF', '#1565C0'],
  habit: ['#7DF5B4', '#0E8A4F'],
  pink: ['#FF8DBB', '#D21E5C'], blue: ['#7CC4FF', '#1F64B5'], green: ['#6BF2A9', '#109A55'],
  amber: ['#FFC86B', '#E07A10'], steelE: ['#9AA3B0', '#5A6370'], teal: ['#6FE7E0', '#128C86'], purple: ['#C7A6FF', '#6A3FD1'], gold: ['#FFD45E', '#C7841A'],
};
const ICON_FOR: Record<string, string> = { walk: 'walk', run: 'run', ride: 'ride', habit: 'leaf' };

let seq = 0;

/** Shape outline, centred on (60, 54), radius ~r. Rounded corners come from a same-colour stroke with round joins. */
function shape(kind: AwardKind, r: number): string {
  const cx = 60, cy = 54;
  const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${(cx + x).toFixed(2)},${(cy + y).toFixed(2)}`).join('L') + 'Z';
  if (kind === 'walk') return poly(Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return [r * Math.cos(a), r * Math.sin(a)] as [number, number]; }));
  if (kind === 'run') return poly([[-r * .86, -r * .82], [r * .86, -r * .82], [r * .86, r * .18], [0, r * 1.02], [-r * .86, r * .18]]);
  if (kind === 'habit') return poly([[0, -r * 1.02], [r * 1.02, 0], [0, r * 1.02], [-r * 1.02, 0]]);
  return `M${cx - r},${cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
}

export type AwardOpts = {
  kind: AwardKind;
  metal: Metal;
  /** enamel colour key (defaults to the kind's own colour) */
  enamel?: string;
  /** icon name from the app's icon set (defaults to the kind's icon) */
  icon?: string;
  /** 1–3 engraved on a small metal tab under the medallion */
  rank?: number;
  /** stand under the medallion (trophies on a shelf). Coins never have one. */
  stand?: boolean;
  label?: string;
};

/** The award as an SVG string. Trophies are cups (viewBox 120 × 150); badges are coins (120 × 112). */
export function awardSvg(o: AwardOpts): string {
  if (o.kind !== 'coin' && o.stand !== false) return cupSvg(o);
  return coinSvg(o);
}

/** Very distinct metals so 1st / 2nd / 3rd read at a glance. */
const CUP_METAL: Record<Metal, { hi: string; mid: string; lo: string; deep: string; ink: string }> = {
  gold:   { hi: '#FFF6C8', mid: '#F5C542', lo: '#B9801A', deep: '#7A4C00', ink: '#5A3600' },
  silver: { hi: '#FFFFFF', mid: '#D9DEE6', lo: '#8E98A6', deep: '#555E6B', ink: '#3A414C' },
  bronze: { hi: '#FFD2B0', mid: '#C9773E', lo: '#8A4520', deep: '#55260C', ink: '#3E1A06' },
  steel:  { hi: '#EEF1F5', mid: '#A9B1BD', lo: '#66707D', deep: '#3D444E', ink: '#2A2F36' },
};

/** A real trophy cup: metal cup with the challenge's logo inlaid on the front, stem, and a black plinth with the place on a plate.
 *  The silhouette changes with the activity: walk = classic two-handled cup, run = tall slim cup with laurels,
 *  ride = wide bowl, habit = lidded cup with a star. */
function cupSvg(o: AwardOpts): string {
  const id = `cp${++seq}`;
  const m = CUP_METAL[o.metal];
  const [e1, e2] = ENAMELS[o.enamel ?? o.kind] ?? ENAMELS.habit;
  const icon = ICON_PATHS[o.icon ?? ICON_FOR[o.kind] ?? 'sparkle'] ?? '';
  const k = o.kind;
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  const place = o.rank === 1 ? '1ST' : o.rank === 2 ? '2ND' : o.rank === 3 ? '3RD' : '';

  // cup body path + emblem centre + handles, per activity
  let body = '', handles = '', extra = '', ex = 60, ey = 44, er = 15;
  if (k === 'run') {            // tall, slim, flared rim; laurel sprigs either side
    body = 'M40 12h40c0 0-1 30-8 44c-3 6-7 9-12 10c-5-1-9-4-12-10c-7-14-8-44-8-44z';
    ey = 38; er = 13;
    const leaf = (x: number, y: number, r: number, f: number) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="6.5" transform="rotate(${r} ${x} ${y})" fill="url(#${id}m)" stroke="${m.lo}" stroke-width=".6" opacity="${f}"/>`;
    extra = `<path d="M40 64C27 58 23 40 31 17M80 64C93 58 97 40 89 17" fill="none" stroke="${m.lo}" stroke-width="1.8" stroke-linecap="round"/>`
      + [[31, 21, -30], [28.5, 32, -12], [28.5, 44, 4], [32.5, 55, 24], [89, 21, 30], [91.5, 32, 12], [91.5, 44, -4], [87.5, 55, -24]].map(([x, y, r], n) => leaf(x, y, r, n % 4 === 3 ? .85 : 1)).join('');
  } else if (k === 'ride') {    // wide, shallow bowl with small handles
    body = 'M24 18h72c0 0 0 20-10 31c-6 7-15 11-26 11s-20-4-26-11c-10-11-10-31-10-31z';
    handles = `<path d="M26 24c-9 0-12 10-4 16" fill="none" stroke="url(#${id}h)" stroke-width="4" stroke-linecap="round"/><path d="M94 24c9 0 12 10 4 16" fill="none" stroke="url(#${id}h)" stroke-width="4" stroke-linecap="round"/>`;
    ey = 38; er = 13.5;
  } else if (k === 'habit') {   // lidded cup with a star finial
    body = 'M34 26h52c0 0 0 22-8 32c-5 6-11 9-18 9s-13-3-18-9c-8-10-8-32-8-32z';
    handles = `<path d="M35 32c-12 0-14 16-1 22" fill="none" stroke="url(#${id}h)" stroke-width="4.2" stroke-linecap="round"/><path d="M85 32c12 0 14 16 1 22" fill="none" stroke="url(#${id}h)" stroke-width="4.2" stroke-linecap="round"/>`;
    extra = `<path d="M31 26c0-6 13-9 29-9s29 3 29 9z" fill="url(#${id}m)" stroke="${m.lo}" stroke-width=".8"/>
      <path d="M60 2.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="url(#${id}m)" stroke="${m.lo}" stroke-width=".7"/>
      <rect x="57.5" y="14.5" width="5" height="4" rx="1" fill="${m.lo}"/>`;
    ey = 44; er = 13.5;
  } else {                      // walk: classic two-handled cup
    body = 'M32 12h56c0 0 1 28-7 40c-5 8-12 12-21 12s-16-4-21-12c-8-12-7-40-7-40z';
    handles = `<path d="M33 19c-14-1-17 18-2 25" fill="none" stroke="url(#${id}h)" stroke-width="4.6" stroke-linecap="round"/><path d="M87 19c14-1 17 18 2 25" fill="none" stroke="url(#${id}h)" stroke-width="4.6" stroke-linecap="round"/>`;
    ey = 36; er = 14.5;
  }
  const rimY = k === 'ride' ? 18 : k === 'habit' ? 26 : 12;
  const rimX1 = k === 'ride' ? 24 : k === 'habit' ? 34 : k === 'run' ? 40 : 32, rimX2 = 120 - rimX1;
  const neckY = k === 'ride' ? 60 : k === 'habit' ? 67 : k === 'run' ? 66 : 64;

  return `<svg class="award cup" viewBox="0 0 120 150" ${a11y}>
<defs>
  <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${m.lo}"/><stop offset=".18" stop-color="${m.mid}"/><stop offset=".36" stop-color="${m.hi}"/><stop offset=".55" stop-color="${m.mid}"/><stop offset=".8" stop-color="${m.lo}"/><stop offset="1" stop-color="${m.deep}"/></linearGradient>
  <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
  <radialGradient id="${id}e" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${e1}"/><stop offset="1" stop-color="${e2}"/></radialGradient>
  <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3A40"/><stop offset=".5" stop-color="#1C1C21"/><stop offset="1" stop-color="#0E0E11"/></linearGradient>
  <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="${id}d" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".35"/></filter>
</defs>
<ellipse cx="60" cy="145" rx="38" ry="4" fill="#000" opacity=".35"/>
${extra && k === 'run' ? extra : ''}
${handles}
<path d="${body}" fill="url(#${id}m)" stroke="${m.lo}" stroke-width=".8"/>
<ellipse cx="60" cy="${rimY}" rx="${(rimX2 - rimX1) / 2}" ry="3.2" fill="${m.deep}" opacity=".55"/>
<rect x="${rimX1 - 1}" y="${rimY - 1.6}" width="${rimX2 - rimX1 + 2}" height="3.2" rx="1.6" fill="url(#${id}m)"/>
${extra && k === 'habit' ? extra : ''}
<path d="M${rimX1 + 9} ${rimY + 6}c1 12 3 22 8 30" fill="none" stroke="url(#${id}s)" stroke-width="3" stroke-linecap="round" opacity=".9"/>
<circle cx="${ex}" cy="${ey}" r="${er + 2.4}" fill="${m.deep}" opacity=".5"/>
<circle cx="${ex}" cy="${ey}" r="${er + 1.2}" fill="url(#${id}h)"/>
<circle cx="${ex}" cy="${ey}" r="${er}" fill="url(#${id}e)"/>
<g transform="translate(${ex} ${ey}) scale(${(er * 1.15) / 12}) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="${1.9 * 12 / (er * 1.15) * 1.05}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}d)"><path d="${icon}"/></g>
<path d="M54 ${neckY}h12l-1.5 10h-9z" fill="url(#${id}m)"/>
<ellipse cx="60" cy="${neckY + 11}" rx="9" ry="3.4" fill="url(#${id}m)" stroke="${m.lo}" stroke-width=".6"/>
<path d="M55.5 ${neckY + 13}h9l3 ${110 - neckY - 13}h-15z" fill="url(#${id}m)"/>
<path d="M42 110h36l3 6H39z" fill="url(#${id}m)" stroke="${m.lo}" stroke-width=".6"/>
<path d="M32 116h56a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H32a3 3 0 0 1-3-3v-19a3 3 0 0 1 3-3z" fill="url(#${id}b)"/>
<path d="M32 116h56a3 3 0 0 1 3 3v1.5H29V119a3 3 0 0 1 3-3z" fill="#fff" opacity=".12"/>
${place ? `<rect x="42" y="122" width="36" height="13" rx="2" fill="url(#${id}m)"/><text x="60" y="132" text-anchor="middle" font-size="9.5" font-weight="800" letter-spacing=".8" fill="${m.ink}" font-family="Sora, system-ui, -apple-system, sans-serif">${place}</text>` : ''}
</svg>`;
}

/** Badge coin: enamel disc with a metal rim and the badge's icon. */
function coinSvg(o: AwardOpts): string {
  const id = `aw${++seq}`;
  const [ml, mm, md, ink] = METALS[o.metal];
  const [e1, e2] = ENAMELS[o.enamel ?? o.kind] ?? ENAMELS.habit;
  const icon = ICON_PATHS[o.icon ?? ICON_FOR[o.kind] ?? 'sparkle'] ?? '';
  const k = o.kind === 'coin' ? 'ride' : o.kind; // the coin is a circle
  const stand = o.stand !== false && o.kind !== 'coin';
  const H = stand ? 140 : 112;
  const outer = shape(k, 44), inner = shape(k, 34), lip = shape(k, 38.5);
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="award" viewBox="0 0 120 ${H}" ${a11y}>
<defs>
  <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ml}"/><stop offset=".38" stop-color="${mm}"/><stop offset=".62" stop-color="${md}"/><stop offset=".82" stop-color="${mm}"/><stop offset="1" stop-color="${ml}"/></linearGradient>
  <linearGradient id="${id}l" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${ml}"/><stop offset=".5" stop-color="${md}"/><stop offset="1" stop-color="${mm}"/></linearGradient>
  <radialGradient id="${id}e" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="${e1}"/><stop offset=".72" stop-color="${e2}"/><stop offset="1" stop-color="${e2}" stop-opacity=".92"/></radialGradient>
  <linearGradient id="${id}g" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="${id}c"><path d="${inner}"/></clipPath>
  <filter id="${id}s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000" flood-opacity=".35"/></filter>
</defs>
${stand ? `<ellipse cx="60" cy="133" rx="30" ry="4.5" fill="#000" opacity=".35"/>
<path d="M50 98h20l3 22H47z" fill="url(#${id}l)"/>
<rect x="34" y="118" width="52" height="13" rx="4" fill="url(#${id}m)"/>
<rect x="34" y="118" width="52" height="3" rx="1.5" fill="#fff" opacity=".35"/>` : ''}
<path d="${outer}" fill="url(#${id}m)" stroke="url(#${id}m)" stroke-width="7" stroke-linejoin="round"/>
<path d="${lip}" fill="url(#${id}l)" stroke="url(#${id}l)" stroke-width="5" stroke-linejoin="round"/>
<path d="${inner}" fill="url(#${id}e)" stroke="url(#${id}e)" stroke-width="5" stroke-linejoin="round"/>
<g clip-path="url(#${id}c)"><circle cx="60" cy="54" r="60" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="2" stroke-dasharray="1 5"/></g>
<g transform="translate(60 54) scale(1.9) translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}s)"><path d="${icon}"/></g>
<path d="${inner}" fill="url(#${id}g)" stroke="url(#${id}g)" stroke-width="5" stroke-linejoin="round" style="mix-blend-mode:screen"/>
${o.rank ? `<g transform="translate(60 ${k === 'run' || k === 'habit' ? 101 : 96})"><circle r="11.5" fill="url(#${id}m)" stroke="${md}" stroke-width="1"/><text y="5.2" text-anchor="middle" font-size="15" font-weight="800" fill="${ink}" font-family="Sora, system-ui, -apple-system, sans-serif">${o.rank}</text></g>` : ''}
</svg>`;
}

/** The award that fits a challenge: shape and colour from what it is (sport or habit). */
export function awardFor(c: { category: string; sport: string | null; habit_key?: string | null }, place: number, icon?: string, opts: Partial<AwardOpts> = {}): string {
  const kind: AwardKind = c.category === 'activity' && (c.sport === 'walk' || c.sport === 'run' || c.sport === 'ride') ? c.sport : 'habit';
  const metal: Metal = place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : 'steel';
  return awardSvg({ kind, metal, rank: place <= 3 ? place : undefined, icon: kind === 'habit' ? icon : undefined, ...opts });
}
