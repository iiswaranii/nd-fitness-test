import { useEffect, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Form';
import { Icon } from './Icon';

const ROW = 40;           // px per row
const VISIBLE = 5;        // rows shown; the middle one is selected

/** "20:05" → "8:05 pm"; empty → "Off". */
export function fmtReminder(v: string | null | undefined) {
  if (!v) return 'Off';
  const [h, m] = v.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** One scrolling, snapping column, like the iPhone time picker. */
function Wheel({ items, index, onIndex, label, width }: { items: string[]; index: number; onIndex: (i: number) => void; label: string; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(index);
  const timer = useRef(0);

  useEffect(() => { const el = ref.current; if (el) el.scrollTop = index * ROW; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = ref.current; if (!el) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)));
    if (i !== last.current) { last.current = i; onIndex(i); try { navigator.vibrate?.(4); } catch { /* not supported */ } }
    clearTimeout(timer.current);
    // Settle exactly on a row once scrolling stops (older browsers without scroll-snap).
    timer.current = window.setTimeout(() => { if (Math.abs(el.scrollTop - i * ROW) > 1) el.scrollTo({ top: i * ROW, behavior: 'smooth' }); }, 120);
  };

  const step = (d: number) => { const el = ref.current; if (el) el.scrollTo({ top: Math.max(0, Math.min(items.length - 1, index + d)) * ROW, behavior: 'smooth' }); };

  return (
    <div ref={ref} className="wheel" style={{ width, height: ROW * VISIBLE }} onScroll={onScroll}
      role="spinbutton" aria-label={label} aria-valuetext={items[index]} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); } if (e.key === 'ArrowDown') { e.preventDefault(); step(1); } }}>
      <div style={{ height: ROW * 2 }} />
      {items.map((t, i) => (
        <div key={t + i} className={`wheel-i${i === index ? ' on' : ''}`} style={{ height: ROW }}
          onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: 'smooth' })}>{t}</div>
      ))}
      <div style={{ height: ROW * 2 }} />
    </div>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const AMPM = ['am', 'pm'];

/** Hour · minute · am/pm wheels. Any minute of the day. */
export function TimeWheels({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h24, m] = (value || '20:00').split(':').map(Number);
  const [hi, setHi] = useState((h24 % 12 || 12) - 1);
  const [mi, setMi] = useState(m);
  const [pi, setPi] = useState(h24 < 12 ? 0 : 1);
  useEffect(() => {
    const h = ((hi + 1) % 12) + (pi === 1 ? 12 : 0);
    onChange(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
  }, [hi, mi, pi]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wheels">
      <div className="wheel-band" aria-hidden="true" />
      <Wheel items={HOURS} index={hi} onIndex={setHi} label="Hour" width={64} />
      <span className="wheel-colon" aria-hidden="true">:</span>
      <Wheel items={MINS} index={mi} onIndex={setMi} label="Minute" width={64} />
      <Wheel items={AMPM} index={pi} onIndex={setPi} label="AM or PM" width={60} />
    </div>
  );
}

/**
 * Reminder time: a button showing the time (or "Off") that opens a sheet with iPhone-style wheels.
 * value / onChange use "HH:MM" (24h); '' means no reminder.
 */
export function ReminderPicker({ value, onChange, title = 'Remind me at', compact, fallback = '20:00' }: {
  value: string; onChange: (v: string) => void; title?: string; compact?: boolean; fallback?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || fallback);
  useEffect(() => { if (open) setDraft(value || fallback); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="field">
      <button type="button" className={`pick-btn ${compact ? 'compact' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog"
        aria-label={`${title}: ${value ? fmtReminder(value) : 'no reminder'}`}>
        <span className={value ? 'pv' : 'pv ph'}>{value ? fmtReminder(value) : 'Off'}</span>
        <Icon name="clock" className="ic pchev" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label={title}>
        <div className="stack">
          <div className="stack tight" style={{ textAlign: 'center' }}>
            <h2 className="h2">{title}</h2>
            <p className="small muted">Only on days you haven’t logged yet.</p>
          </div>
          {open ? <TimeWheels value={draft} onChange={setDraft} /> : null}
          <Button onClick={() => { onChange(draft); setOpen(false); }}>
            <Icon name="bell" />Remind me at {fmtReminder(draft)}
          </Button>
          {value ? <button type="button" className="link-btn muted" style={{ alignSelf: 'center' }} onClick={() => { onChange(''); setOpen(false); }}>Turn reminder off</button> : null}
        </div>
      </Sheet>
    </div>
  );
}
