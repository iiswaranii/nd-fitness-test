/**
 * Awards. Trophies are classic metal cups (see cupSvg); badges are enamel coins with a polished metal rim, in the spirit of Apple Fitness awards.
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

/** A classic gold-cup trophy in the spirit of a sports cup: ornate curled handles, the challenge's emblem
 *  embossed in a raised medallion on the front, a star beneath it, a knotted stem, and a black plinth with
 *  a metal plate showing the place. The metal itself is the place: gold 1st, silver 2nd, bronze 3rd. */
function cupSvg(o: AwardOpts): string {
  const id = `cp${++seq}`;
  const m = CUP_METAL[o.metal];
  const icon = ICON_PATHS[o.icon ?? ICON_FOR[o.kind] ?? 'sparkle'] ?? '';
  const a11y = o.label ? `role="img" aria-label="${o.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  const place = o.rank === 1 ? '1ST' : o.rank === 2 ? '2ND' : o.rank === 3 ? '3RD' : '';
  const star = (cx: number, cy: number, r: number) => {
    const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * .45 : r; return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`; });
    return 'M' + pts.join('L') + 'Z';
  };
  const handle = 'M28 17C22 13 17 9.5 12 10C7.5 10.5 6 15 9.5 17C11.5 18 13 16.5 12 15M12 15C9 25 15 43 35 60C39 63.5 42.5 60.5 40 57.5C38.5 56 36 56.5 36.5 58.5';
  const handleR = 'M92 17C98 13 103 9.5 108 10C112.5 10.5 114 15 110.5 17C108.5 18 107 16.5 108 15M108 15C111 25 105 43 85 60C81 63.5 77.5 60.5 80 57.5C81.5 56 84 56.5 83.5 58.5';
  const body = 'M27 11C26.5 33 30 51 43 66C47.5 71 51 75 52.5 80H67.5C69 75 72.5 71 77 66C90 51 93.5 33 93 11Z';
  const icS = 1.02; // emblem scale (24-unit icons → ~24px)
  return `<svg class="award cup" viewBox="0 0 120 150" ${a11y}>
<defs>
  <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${m.deep}"/><stop offset=".1" stop-color="${m.lo}"/><stop offset=".26" stop-color="${m.mid}"/><stop offset=".38" stop-color="${m.hi}"/><stop offset=".5" stop-color="${m.mid}"/><stop offset=".72" stop-color="${m.lo}"/><stop offset=".9" stop-color="${m.deep}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
  <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
  <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".45" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
  <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.deep}"/></linearGradient>
  <linearGradient id="${id}rr" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${m.hi}"/><stop offset=".55" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
  <radialGradient id="${id}d" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${m.mid}"/><stop offset=".7" stop-color="${m.lo}"/><stop offset="1" stop-color="${m.deep}"/></radialGradient>
  <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3C3C42"/><stop offset=".25" stop-color="#18181C"/><stop offset="1" stop-color="#050507"/></linearGradient>
  <linearGradient id="${id}bx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="${id}c"><path d="${body}"/></clipPath>
</defs>
<ellipse cx="60" cy="146" rx="40" ry="3.6" fill="#000" opacity=".35"/>
<!-- handles: metal with a dark inner channel -->
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="${handle}" stroke="${m.deep}" stroke-width="9.4"/><path d="${handle}" stroke="url(#${id}h)" stroke-width="7.4"/><path d="${handle}" stroke="${m.deep}" stroke-width="2.4" opacity=".9"/><path d="${handle}" stroke="${m.hi}" stroke-width=".7" opacity=".7" transform="translate(-1.6 -.6)"/>
  <path d="${handleR}" stroke="${m.deep}" stroke-width="9.4"/><path d="${handleR}" stroke="url(#${id}h)" stroke-width="7.4"/><path d="${handleR}" stroke="${m.deep}" stroke-width="2.4" opacity=".9"/><path d="${handleR}" stroke="${m.hi}" stroke-width=".7" opacity=".5" transform="translate(1.6 -.6)"/>
</g>
<!-- cup -->
<path d="${body}" fill="url(#${id}m)"/>
<g clip-path="url(#${id}c)">
  <path d="${body}" fill="url(#${id}v)"/>
  <!-- flat facets either side, and the V panels that sweep to the stem -->
  <path d="M27 11C27 30 30 46 38 58L45 30L40 11Z" fill="${m.deep}" opacity=".22"/>
  <path d="M93 11C93 30 90 46 82 58L75 30L80 11Z" fill="#fff" opacity=".08"/>
  <path d="M35 52C42 58 50 66 55 80M85 52C78 58 70 66 65 80" fill="none" stroke="${m.deep}" stroke-width="2" opacity=".85"/>
  <path d="M35.8 51C42.8 57 50.8 65 55.8 79M84.2 51C77.2 57 69.2 65 64.2 79" fill="none" stroke="${m.hi}" stroke-width=".9" opacity=".8"/>
  <path d="M41 13V40M79 13V40" stroke="${m.deep}" stroke-width=".8" opacity=".45"/>
  <path d="M36 14C35.5 30 37 44 42 54" fill="none" stroke="url(#${id}s)" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>
</g>
<!-- rim -->
<ellipse cx="60" cy="11.5" rx="33" ry="3.4" fill="${m.deep}"/>
<path d="M25.5 7.5h69a2 2 0 0 1 2 2v2.4a2 2 0 0 1-2 2h-69a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z" fill="url(#${id}m)"/>
<path d="M26 8.2h68" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>
<!-- medallion with the challenge emblem embossed -->
<circle cx="60" cy="35" r="17.2" fill="${m.deep}" opacity=".55"/>
<circle cx="60" cy="35" r="16.2" fill="url(#${id}r)"/>
<circle cx="60" cy="35" r="13.4" fill="url(#${id}rr)"/>
<circle cx="60" cy="35" r="12.4" fill="url(#${id}d)"/>
<g transform="translate(60 35) scale(${icS}) translate(-12 -12)" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="${icon}" stroke="${m.deep}" stroke-width="3" transform="translate(.35 .55)" opacity=".8"/>
  <path d="${icon}" stroke="${m.hi}" stroke-width="2.2"/>
</g>
<!-- star -->
<path d="${star(60, 61, 7)}" fill="${m.deep}" transform="translate(.5 .8)" opacity=".85"/>
<path d="${star(60, 61, 7)}" fill="url(#${id}r)"/>
<path d="${star(60, 61, 7)}" fill="none" stroke="${m.hi}" stroke-width=".5" opacity=".8"/>
<!-- collar, knot, stem and base -->
<path d="M50 79.5h20a2 2 0 0 1 2 2v1.4a2 2 0 0 1-2 2H50a2 2 0 0 1-2-2v-1.4a2 2 0 0 1 2-2z" fill="url(#${id}m)"/>
<path d="M53.5 85h13c.5 3 2.5 4.5 2.5 6.5s-2 3.5-2.5 4.5h-13c-.5-1-2.5-2.5-2.5-4.5s2-3.5 2.5-6.5z" fill="url(#${id}m)"/>
<path d="M55.5 96h9c1 4 5 7 12 8.5h-33c7-1.5 11-4.5 12-8.5z" fill="url(#${id}m)"/>
<path d="M40 104.5h40a2 2 0 0 1 2 2v1.6a2 2 0 0 1-2 2H40a2 2 0 0 1-2-2v-1.6a2 2 0 0 1 2-2z" fill="url(#${id}m)"/>
<path d="M33.5 110h53a2.2 2.2 0 0 1 2.2 2.2v1.6H31.3v-1.6a2.2 2.2 0 0 1 2.2-2.2z" fill="url(#${id}m)"/>
<path d="M40 105h40" stroke="#fff" stroke-opacity=".5" stroke-width=".7"/>
<!-- black plinth -->
<path d="M30 113.8h60c1.6 0 2.8 1.3 2.9 2.9l1.6 21.3H25.5l1.6-21.3c.1-1.6 1.3-2.9 2.9-2.9z" fill="url(#${id}b)"/>
<path d="M30 113.8h60c1.6 0 2.8 1.3 2.9 2.9l1.6 21.3H25.5l1.6-21.3c.1-1.6 1.3-2.9 2.9-2.9z" fill="url(#${id}bx)"/>
<path d="M24 138h72a2 2 0 0 1 2 2v2.2a2 2 0 0 1-2 2H24a2 2 0 0 1-2-2V140a2 2 0 0 1 2-2z" fill="url(#${id}m)"/>
${place ? `<g>
  <path d="M38 119h44l2 2v11l-2 2H38l-2-2v-11z" fill="${m.deep}"/>
  <path d="M38.4 119.6h43.2l1.7 1.7v10.4l-1.7 1.7H38.4l-1.7-1.7v-10.4z" fill="url(#${id}m)"/>
  <path d="M39.6 121.2h40.8l.9.9v8.8l-.9.9H39.6l-.9-.9v-8.8z" fill="none" stroke="${m.deep}" stroke-width=".55" opacity=".7"/>
  <path d="${star(44.3, 126.5, 2.3)}M${star(75.7, 126.5, 2.3).slice(1)}" fill="${m.ink}" opacity=".75"/>
  <text x="60" y="129.7" text-anchor="middle" font-size="8.6" font-weight="800" letter-spacing=".9" fill="${m.ink}" font-family="Sora, system-ui, -apple-system, sans-serif">${place}</text>
</g>` : ''}
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
