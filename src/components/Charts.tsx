/** Horizontal bars, one hue, value labelled at the end of each bar (no hover needed on phones). */
export function HBars({ rows, color = 'var(--ride)', unit = '', label }: { rows: { label: string; value: number; sub?: string }[]; color?: string; unit?: string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars" role="table" aria-label={label}>
      {rows.map((r) => (
        <div className="hbar" role="row" key={r.label} title={`${r.label}: ${r.value}${unit}`}>
          <span className="hl" role="cell">{r.label}{r.sub ? <small>{r.sub}</small> : null}</span>
          <span className="ht" role="cell" aria-hidden="true"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} /></span>
          <span className="hv" role="cell">{r.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

/** Vertical bars for a short time series. */
export function VBars({ rows, color = 'var(--good)', label }: { rows: { label: string; value: number }[]; color?: string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="vbars" role="table" aria-label={label}>
      {rows.map((r) => (
        <div className="vbar" role="row" key={r.label} title={`${r.label}: ${r.value}`}>
          <span className="vv" role="cell">{r.value}</span>
          <span className="vt" aria-hidden="true"><i style={{ height: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} /></span>
          <span className="vl" role="cell">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A segmented status bar with labels and counts beside each colour, so colour is never the only cue. */
export function StatusBar({ parts }: { parts: { label: string; value: number; color: string; hint: string }[] }) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0));
  return (
    <div className="stack tight">
      <div className="sbar" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {parts.map((p) => p.value ? <i key={p.label} style={{ flex: p.value, background: p.color }} /> : null)}
      </div>
      <div className="slegend">
        {parts.map((p) => (
          <div key={p.label}>
            <span className="row" style={{ gap: 6 }}><i style={{ background: p.color }} /><span className="strong">{p.label}</span></span>
            <span className="big" style={{ fontSize: 24 }}>{p.value}<small>{Math.round((p.value / total) * 100)}%</small></span>
            <span className="small muted">{p.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
