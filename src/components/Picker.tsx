import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

export type Option = { value: string; label: string; sub?: string };

/**
 * Mobile-style dropdown: a tappable field that opens a bottom sheet of large options.
 * Long lists get a search box. Replaces the browser's desktop-style <select>.
 */
export function Picker({ label, value, options, onChange, placeholder = 'Choose…', title, search, compact, near }: {
  label?: string; value: string; options: Option[]; onChange: (v: string) => void;
  placeholder?: string; title?: string; search?: boolean; compact?: boolean;
  /** With nothing chosen yet, open the list scrolled to this option (e.g. a typical height). */
  near?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const sel = options.find((o) => o.value === value);
  const withSearch = search ?? options.length > 10;
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase();
    return w ? options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(w)) : options;
  }, [q, options]);

  // Open at the current choice.
  useEffect(() => {
    if (!open) { setQ(''); return; }
    const t = setTimeout(() => (listRef.current?.querySelector('[aria-selected="true"]') ?? (near ? listRef.current?.querySelector(`[data-v="${near}"]`) : null))?.scrollIntoView({ block: 'center' }), 60);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div className="field">
      {label ? <span className="label">{label}</span> : null}
      <button type="button" className={`pick-btn ${compact ? 'compact' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={label ? `${label}: ${sel?.label ?? 'not chosen'}` : sel?.label ?? placeholder}>
        <span className={sel ? 'pv' : 'pv ph'}>{sel ? sel.label : placeholder}</span>
        <Icon name="chev" className="ic pchev" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={title ?? label ?? 'Choose'}>
        <div className="stack tight">
          <h2 className="h2">{title ?? label ?? 'Choose'}</h2>
          {withSearch ? (
            <div className="input-wrap">
              <input className="input" style={{ paddingLeft: 44 }} type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search options" />
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" /></span>
            </div>
          ) : null}
          <div className="pick-list combo-list" role="listbox" ref={listRef}>
            {shown.length ? shown.map((o) => (
              <button key={o.value} data-v={o.value} type="button" role="option" aria-selected={o.value === value} className="pick-opt"
                onClick={() => { onChange(o.value); setOpen(false); }}>
                <span className="grow"><span className="strong" style={{ display: 'block' }}>{o.label}</span>{o.sub ? <span className="small muted">{o.sub}</span> : null}</span>
                {o.value === value ? <Icon name="check" /> : null}
              </button>
            )) : <p className="small muted" style={{ padding: 16 }}>Nothing matches “{q}”.</p>}
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/** Mobile multi-select: tick several options in a bottom sheet, then Done. */
export function MultiPicker({ label, values, options, onChange, placeholder = 'Choose…', title }: {
  label: string; values: string[]; options: Option[]; onChange: (v: string[]) => void; placeholder?: string; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>(values);
  useEffect(() => { if (open) { setSel(values); setQ(''); } }, [open, values]);
  const shown = useMemo(() => { const w = q.trim().toLowerCase(); return w ? options.filter((o) => o.label.toLowerCase().includes(w)) : options; }, [q, options]);
  const summary = values.length === 0 ? placeholder : values.length <= 2 ? values.join(', ') : `${values.slice(0, 2).join(', ')} +${values.length - 2}`;
  return (
    <div className="field">
      <span className="label">{label}</span>
      <button type="button" className="pick-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${label}: ${values.length ? values.join(', ') : 'none chosen'}`}>
        <span className={values.length ? 'pv' : 'pv ph'}>{summary}</span>
        <Icon name="chev" className="ic pchev" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={title ?? label}>
        <div className="stack tight">
          <div className="sec-h"><h2 className="h2">{title ?? label}</h2>{sel.length ? <button type="button" className="link-btn" onClick={() => setSel([])}>Clear</button> : null}</div>
          {options.length > 10 ? (
            <div className="input-wrap">
              <input className="input" style={{ paddingLeft: 44 }} type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search options" />
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}><Icon name="search" /></span>
            </div>
          ) : null}
          <div className="pick-list combo-list" role="listbox" aria-multiselectable="true">
            {shown.map((o) => {
              const on = sel.includes(o.value);
              return (
                <button key={o.value} type="button" role="option" aria-selected={on} className="pick-opt"
                  onClick={() => setSel((s) => (on ? s.filter((x) => x !== o.value) : [...s, o.value]))}>
                  <span className={`tick ${on ? 'on' : ''}`} aria-hidden="true">{on ? <Icon name="check" /> : null}</span>
                  <span className="grow strong">{o.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="btn" onClick={() => { onChange(sel); setOpen(false); }}>Done{sel.length ? ` · ${sel.length} chosen` : ''}</button>
        </div>
      </Sheet>
    </div>
  );
}
