/** Three nested activity rings — walk, run, ride. */
export function BrandMark({ size = 88 }: { size?: number }) {
  const rings = [
    { pct: 0.78, color: 'var(--walk)' },
    { pct: 0.58, color: 'var(--run)' },
    { pct: 0.4, color: 'var(--ride)' },
  ];
  const c = 50, sw = 10.5, gap = 2.4;
  let r = 50 - sw / 2;
  return (
    <svg className="brand-mark" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Namdhari Health & Fitness">
      {rings.map((it, i) => {
        const C = 2 * Math.PI * r;
        const el = (
          <g key={i}>
            <circle cx={c} cy={c} r={r} fill="none" style={{ stroke: it.color }} strokeOpacity={0.17} strokeWidth={sw} />
            <circle cx={c} cy={c} r={r} fill="none" style={{ stroke: it.color }} strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - it.pct)} transform={`rotate(-90 ${c} ${c})`} />
          </g>
        );
        r -= sw + gap;
        return el;
      })}
    </svg>
  );
}
