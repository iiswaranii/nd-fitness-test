/** A cup trophy drawn in SVG. `tier` picks the metal; `rank` (1–3) is engraved on the base. */
export type Tier = 'gold' | 'silver' | 'bronze' | 'blue';
const METAL: Record<Tier, [string, string, string]> = {
  gold: ['#FFD86B', '#F2B33D', '#B97A12'],
  silver: ['#EEF1F5', '#B9C1CC', '#7E8794'],
  bronze: ['#F2B583', '#D9915A', '#94522A'],
  blue: ['#9CCBFF', '#4A9BEF', '#1F64B5'],
};

export function Trophy({ tier, size = 56, rank, label }: { tier: Tier; size?: number; rank?: number; label?: string }) {
  const [hi, mid, lo] = METAL[tier];
  const id = `tg-${tier}`;
  return (
    <svg className="trophy" width={size} height={size} viewBox="0 0 64 64" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hi} /><stop offset="0.55" stopColor={mid} /><stop offset="1" stopColor={lo} />
        </linearGradient>
      </defs>
      {/* handles */}
      <path d="M16 13H8.5a2 2 0 0 0-2 2.2C7.4 23.6 11 28 18 29.5" fill="none" stroke={mid} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M48 13h7.5a2 2 0 0 1 2 2.2C56.6 23.6 53 28 46 29.5" fill="none" stroke={mid} strokeWidth="3.4" strokeLinecap="round" />
      {/* cup */}
      <path d="M15 8h34v10c0 10-7.6 18-17 18S15 28 15 18Z" fill={`url(#${id})`} />
      <path d="M21 11v7c0 5 3 9.5 7 11.4" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2.4" strokeLinecap="round" />
      {/* stem and base */}
      <path d="M28.5 36h7v8h-7z" fill={mid} />
      <path d="M23 44h18a2 2 0 0 1 2 2v3H21v-3a2 2 0 0 1 2-2Z" fill={lo} />
      <rect x="17" y="49" width="30" height="8" rx="2.5" fill={`url(#${id})`} />
      {rank ? <text x="32" y="55.6" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={lo} fontFamily="system-ui, sans-serif">{rank}</text> : null}
    </svg>
  );
}
