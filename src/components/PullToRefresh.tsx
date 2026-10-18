import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

const THRESHOLD = 70;

/**
 * Pull down from the top to refresh, like native apps:
 * a ring fills as you pull, the arrow flips at the threshold (with a tiny vibration on Android),
 * then it spins while loading and the page settles back.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'pull' | 'ready' | 'busy' | 'done'>('idle');
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let y0 = -1, x0 = 0, pull = 0, locked = false;
    const set = (p: number) => {
      el.style.setProperty('--pull', `${p}px`);
      el.style.setProperty('--pp', String(Math.min(1, p / THRESHOLD)));
    };
    const start = (e: TouchEvent) => {
      const s = stateRef.current;
      if (s === 'busy' || s === 'done' || window.scrollY > 2 || document.body.style.overflow === 'hidden') { y0 = -1; return; }
      if ((e.target as HTMLElement).closest('.car, .chip-row, .tbl, input, textarea, select')) { y0 = -1; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; pull = 0; locked = false;
    };
    const move = (e: TouchEvent) => {
      if (y0 < 0) return;
      const dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
      if (!locked) { if (dx > 10 && dx > dy) { y0 = -1; return; } if (dy > 6) locked = true; else return; }
      if (dy <= 0 || window.scrollY > 2) { pull = 0; set(0); setState('idle'); return; }
      // Rubber band: the further you pull, the harder it gets.
      pull = Math.min(130, THRESHOLD * (1 - Math.exp(-dy / 160)) * 1.9);
      el.classList.add('pulling');
      set(pull);
      const ready = pull >= THRESHOLD;
      if (ready && stateRef.current !== 'ready') { navigator.vibrate?.(8); setState('ready'); }
      else if (!ready && stateRef.current !== 'pull') setState('pull');
      if (e.cancelable) e.preventDefault();
    };
    const end = async () => {
      if (y0 < 0) return;
      y0 = -1;
      el.classList.remove('pulling');
      if (pull >= THRESHOLD) {
        set(56); setState('busy');
        try { await onRefresh(); } catch { /* the page shows its own errors */ }
        setState('done');
        setTimeout(() => { set(0); setState('idle'); }, 450);
      } else { set(0); setState('idle'); }
      pull = 0;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end);
    };
  }, [onRefresh]);

  const C = 2 * Math.PI * 13;
  return (
    <div className={`ptr ptr-${state}`} ref={ref}>
      <div className="ptr-ind" aria-hidden="true">
        <svg viewBox="0 0 32 32" className="ptr-ring">
          <circle cx="16" cy="16" r="13" fill="none" stroke="var(--line-strong)" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="13" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={C} style={{ strokeDashoffset: `calc(${C}px * (1 - var(--pp, 0)))` }} transform="rotate(-90 16 16)" className="ptr-arc" />
        </svg>
        {state === 'done' ? <Icon name="check" className="ic ptr-icon" /> : <Icon name="download" className="ic ptr-icon ptr-arrow" />}
      </div>
      <span className="sr-only" role="status">{state === 'busy' ? 'Refreshing' : state === 'done' ? 'Updated' : ''}</span>
      <div className="ptr-body">{children}</div>
    </div>
  );
}

/** Small round refresh button for page headers — for people who don't know about pull-to-refresh. */
export function RefreshButton({ onRefresh, label = 'Refresh' }: { onRefresh: () => Promise<unknown>; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className={`refresh-btn ${busy ? 'busy' : ''}`} aria-label={label} disabled={busy}
      onClick={async () => { setBusy(true); try { await onRefresh(); } catch { /* shown by page */ } finally { setTimeout(() => setBusy(false), 300); } }}>
      <Icon name="sync" />
    </button>
  );
}
