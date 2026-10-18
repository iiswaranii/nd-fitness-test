import { useEffect, useState } from 'react';

/** Concentric progress rings (outermost first). Animates in from empty. */
export function Rings({ rings, size, label, children }: {
  rings: { pct: number; color: string }[]; size: number; label: string; children?: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))); return () => cancelAnimationFrame(r); }, []);
  const sw = size * 0.105, gap = sw * 0.22, c = size / 2;
  let r = size / 2 - sw / 2;
  return (
    <div className="ringwrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {rings.map((it, i) => {
          const C = 2 * Math.PI * r, off = C * (1 - Math.min(100, Math.max(0, it.pct)) / 100);
          const el = (
            <g key={i}>
              <circle cx={c} cy={c} r={r} fill="none" style={{ stroke: it.color }} strokeOpacity={0.17} strokeWidth={sw} />
              {it.pct > 0 ? (
                <circle className="ring-fg" cx={c} cy={c} r={r} fill="none" style={{ stroke: it.color }} strokeWidth={sw} strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={on ? off : C} transform={`rotate(-90 ${c} ${c})`} />
              ) : null}
            </g>
          );
          r -= sw + gap;
          return el;
        })}
      </svg>
      {children ? <div className="ring-c">{children}</div> : null}
    </div>
  );
}

export function Bar({ pct, color, small }: { pct: number; color: string; small?: boolean }) {
  const [w, setW] = useState(0);
  useEffect(() => { const r = requestAnimationFrame(() => setW(pct)); return () => cancelAnimationFrame(r); }, [pct]);
  return <div className={`bar ${small ? 'sm' : ''}`} style={{ ['--c' as string]: color }}><i style={{ width: `${Math.min(100, w)}%` }} /></div>;
}
