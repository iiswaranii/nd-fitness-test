/** A cup trophy drawn in SVG. `tier` picks the metal; `rank` (1–3) is engraved large on the cup. */
export type Tier = 'gold' | 'silver' | 'bronze' | 'blue';
const METAL: Record<Tier, [string, string, string, string]> = {
  //       highlight   body        shadow      engraving
  gold:   ['#FFE79A', '#F4B935', '#B47A10', '#7A4E00'],
  silver: ['#FFFFFF', '#C9D0DA', '#858E9B', '#4E5663'],
  bronze: ['#F6C29A', '#CD8248', '#8A4A1E', '#5A2C0C'],
  blue:   ['#B9DCFF', '#4A9BEF', '#1F64B5', '#0E3A70'],
};

export function Trophy({ tier, size = 56, rank, label }: { tier: Tier; size?: number; rank?: number; label?: string }) {
  const [hi, mid, lo, ink] = METAL[tier];
  const id = `tg-${tier}`;
  return (
    <svg className="trophy" width={size} height={size} viewBox="0 0 64 64" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.9">
          <stop offset="0" stopColor={hi} /><stop offset="0.45" stopColor={mid} /><stop offset="1" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A3426" /><stop offset="1" stopColor="#24180F" />
        </linearGradient>
      </defs>
      {/* handles */}
      <path d="M16 12H8.8a2 2 0 0 0-2 2.2C7.6 22.6 11 27.2 18 28.8" fill="none" stroke={mid} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M48 12h7.2a2 2 0 0 1 2 2.2C56.4 22.6 53 27.2 46 28.8" fill="none" stroke={mid} strokeWidth="3.4" strokeLinecap="round" />
      {/* cup */}
      <path d="M14.5 7h35v11c0 10.4-7.8 18.5-17.5 18.5S14.5 28.4 14.5 18Z" fill={`url(#${id})`} />
      <path d="M14.5 7h35v2.6h-35z" fill={hi} opacity=".7" />
      <path d="M19.5 11v6.5c0 5.4 3 9.6 7 11.6" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2.2" strokeLinecap="round" />
      {rank ? (
        <text x="32" y="27.5" textAnchor="middle" fontSize="17" fontWeight="900" fill={ink} fillOpacity=".85"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif">{rank}</text>
      ) : null}
      {/* stem and base */}
      <path d="M28.5 36h7v7h-7z" fill={mid} />
      <path d="M23.5 43h17a2 2 0 0 1 2 2v2.5h-21V45a2 2 0 0 1 2-2Z" fill={lo} />
      <rect x="16.5" y="47.5" width="31" height="10" rx="2.2" fill={`url(#${id}-b)`} />
      <rect x="23" y="50.2" width="18" height="4.6" rx="1" fill={mid} />
    </svg>
  );
}
