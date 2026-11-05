import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlacings } from './Badges';
import { Icon } from './Icon';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { hasBoard } from '../lib/board';
import { status } from '../lib/progress';
import { lookOf } from '../lib/look';
import { awardSvg, type AwardKind } from '../lib/award';
import { addDays, fmtDay, today } from '../lib/dates';

type Cup = { id: string; title: string; rank: 1 | 2 | 3; of: number; end: string; kind: AwardKind; icon?: string; sample?: boolean };
const ORD = { 1: '1st', 2: '2nd', 3: '3rd' } as const;
const METAL = { 1: 'gold', 2: 'silver', 3: 'bronze' } as const;
const PER_SHELF = 3;

/** Preview trophies, shown only to the app owner so he can see a full room. Remove when real ones exist. */
const PREVIEW_FOR = ['swaran2596@gmail.com'];
const SAMPLES: [string, 1 | 2 | 3, number, AwardKind, string?][] = [
  ['Diwali 10K walk', 1, 42, 'walk'], ['Morning run streak', 2, 31, 'run'], ['Hydration week', 1, 58, 'habit', 'drop'], ['Weekend ride 50', 3, 19, 'ride'],
  ['5K easy walk', 2, 64, 'walk'], ['Sleep by 11', 1, 27, 'habit', 'moon'], ['Gurpurab steps', 3, 80, 'walk'], ['Monsoon miles', 2, 22, 'run'],
  ['Early riser', 1, 35, 'habit', 'sun'], ['Sangat cycle', 3, 17, 'ride'],
];

function useCups(): { cups: Cup[]; samples: boolean } {
  const { challenges } = useStore();
  const { user } = useSession();
  const placings = usePlacings();
  return useMemo(() => {
    const real: Cup[] = challenges
      .filter((c) => c.joined && status(c) === 'finished' && hasBoard(c))
      .map((c): Cup | null => {
        const pl = placings[c.id];
        if (!pl || pl.rank > 3) return null;
        const kind: AwardKind = c.category === 'activity' && c.sport ? c.sport : 'habit';
        return { id: c.id, title: c.title, rank: pl.rank as 1 | 2 | 3, of: pl.of, end: c.end_date, kind, icon: kind === 'habit' ? lookOf(c).icon : undefined };
      })
      .filter((x): x is Cup => !!x);
    const preview = !!user?.email && PREVIEW_FOR.includes(user.email.toLowerCase());
    const samples: Cup[] = preview
      ? SAMPLES.map(([title, rank, of, kind, icon], i) => ({ id: `sample-${i}`, title, rank, of, kind, icon, end: addDays(today(), -9 * (i + 1)), sample: true }))
      : [];
    return { cups: [...real, ...samples].sort((a, b) => a.rank - b.rank || b.end.localeCompare(a.end)), samples: samples.length > 0 };
  }, [challenges, placings, user]);
}

function AwardArt({ c }: { c: Cup }) {
  const svg = useMemo(() => awardSvg({ kind: c.kind, metal: METAL[c.rank], rank: c.rank, icon: c.icon }), [c.kind, c.rank, c.icon]);
  return <span className="aw-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Shelf({ items, onOpen, empty }: { items: (Cup | null)[]; onOpen: (c: Cup) => void; empty?: boolean }) {
  return (
    <div className="case">
      <div className="case-lights" aria-hidden="true"><i /><i /><i /></div>
      <div className="case-row">
        {items.map((c, i) => c ? (
          <button key={c.id} className={`aw r${c.rank}`} disabled={c.sample} onClick={() => onOpen(c)}
            aria-label={`${ORD[c.rank]} place in ${c.title}, out of ${c.of}${c.sample ? ' (sample)' : ''}`}>
            <AwardArt c={c} />
          </button>
        ) : <div key={`e${i}`} className={`aw ${empty ? 'ghost' : 'gap'}`} aria-hidden="true">{empty ? <span className="aw-ghost" /> : null}</div>)}
      </div>
      <div className="case-glass" aria-hidden="true" />
      <div className="case-plaques">
        {items.map((c, i) => c ? (
          <div key={c.id} className="plq"><b>{c.title}</b><span>{ORD[c.rank]} of {c.of} · {fmtDay(c.end)}</span></div>
        ) : <div key={`p${i}`} className="plq" aria-hidden="true" />)}
      </div>
    </div>
  );
}

const chunk = <T,>(xs: T[], n: number) => { const out: (T | null)[][] = []; for (let i = 0; i < xs.length; i += n) out.push(Array.from({ length: n }, (_, k) => xs[i + k] ?? null)); return out; };

/**
 * Profile: one lit display shelf with your best three. "Open trophy room" shows them all.
 * Full screen (Trophy room): shelves around you in a gentle first-person view; swipe to turn.
 */
export function TrophyRack({ full = false }: { full?: boolean }) {
  const nav = useNavigate();
  const { cups, samples } = useCups();
  const count = (r: 1 | 2 | 3) => cups.filter((c) => c.rank === r).length;
  const open = (c: Cup) => { if (!c.sample) nav(`/c/${c.id}`); };

  const tally = cups.length ? (
    <span className="tally" aria-label={`${count(1)} gold, ${count(2)} silver, ${count(3)} bronze`}>
      <span><i className="t-g" />{count(1)}</span><span><i className="t-s" />{count(2)}</span><span><i className="t-b" />{count(3)}</span>
    </span>
  ) : null;

  if (full) {
    return (
      <section className="stack">
        <div className="sec-h"><span className="small muted">{cups.length ? 'Swipe to look around' : ''}</span>{tally}</div>
        {cups.length ? <TrophyRoom shelves={chunk(cups, PER_SHELF)} onOpen={open} /> : <Shelf items={[null, null, null]} onOpen={open} empty />}
        {!cups.length ? <p className="cab-note">Finish 1st, 2nd or 3rd on a challenge leaderboard to win your first trophy.</p> : null}
        {samples ? <p className="tiny muted" style={{ textAlign: 'center' }}>Sample trophies for preview. Only you can see these.</p> : null}
      </section>
    );
  }

  return (
    <section className="stack tight">
      <div className="sec-h"><h2 className="h2">Trophies</h2>{tally}</div>
      <Shelf items={cups.length ? chunk(cups.slice(0, PER_SHELF), PER_SHELF)[0] : [null, null, null]} onOpen={open} empty={!cups.length} />
      {!cups.length ? <p className="cab-note">Finish 1st, 2nd or 3rd on a challenge leaderboard to win your first trophy.</p> : null}
      {cups.length ? (
        <button className="link-btn cab-more" onClick={() => nav('/trophies')}>
          <Icon name="trophy" className="ic" />{cups.length > PER_SHELF ? `Open trophy room · ${cups.length} trophies` : 'Open trophy room'}
        </button>
      ) : null}
      {samples ? <p className="tiny muted" style={{ textAlign: 'center' }}>Sample trophies for preview. Only you can see these.</p> : null}
    </section>
  );
}

/** Shelves placed around the viewer on a gentle curve. Drag / swipe (or the arrows) to turn; it settles on a shelf. */
function TrophyRoom({ shelves, onOpen }: { shelves: (Cup | null)[][]; onOpen: (c: Cup) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState<number | null>(null); // live offset in shelves while dragging
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = shelves.length;
  const pw = Math.min(340, w - 56);                 // shelf width
  const step = 34;                                   // degrees between shelves
  const R = pw / 2 / Math.tan((step / 2) * Math.PI / 180) + 8;
  const pos = idx + (drag ?? 0);
  const go = (i: number) => { setIdx(Math.max(0, Math.min(n - 1, i))); try { navigator.vibrate?.(5); } catch { /* not supported */ } };

  const down = (e: RPointerEvent) => { if ((e.target as HTMLElement).closest('button')) return; start.current = { x: e.clientX, y: e.clientY, locked: null }; };
  const move = (e: RPointerEvent) => {
    const s = start.current; if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.locked === null && Math.hypot(dx, dy) > 8) { s.locked = Math.abs(dx) > Math.abs(dy); if (s.locked) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    if (s.locked) { let d = -dx / pw; if (idx + d < 0 || idx + d > n - 1) d *= .35; setDrag(d); }
  };
  const up = () => { const s = start.current; start.current = null; if (!s?.locked || drag === null) { setDrag(null); return; } go(Math.abs(drag) > .18 && Math.abs(drag) < .5 ? idx + Math.sign(drag) : Math.round(idx + drag)); setDrag(null); };

  return (
    <div className="room" ref={wrap}>
      <div className="room-view" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: 'pan-y' }}>
        <div className="room-floor" aria-hidden="true" />
        <div className="room-scene" style={{ transform: `translateZ(${R}px) rotateY(${pos * step}deg)`, transition: drag === null ? 'transform .55s cubic-bezier(.2,.8,.2,1)' : 'none' }}>
          {shelves.map((items, i) => {
            const off = Math.abs(i - pos);
            return (
              <div key={i} className="room-wall" aria-hidden={i !== idx} style={{ width: pw, marginLeft: -pw / 2, transform: `rotateY(${-i * step}deg) translateZ(${-R}px)`, opacity: off > 2.2 ? 0 : 1 - Math.min(.55, off * .3) }}>
                <Shelf items={items} onOpen={onOpen} />
              </div>
            );
          })}
        </div>
      </div>
      {n > 1 ? (
        <div className="room-nav">
          <button className="navb" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous shelf"><Icon name="back" /></button>
          <div className="dots" aria-hidden="true">{shelves.map((_, i) => <i key={i} className={i === idx ? 'on' : ''} />)}</div>
          <button className="navb" onClick={() => go(idx + 1)} disabled={idx === n - 1} aria-label="Next shelf"><Icon name="chev" /></button>
        </div>
      ) : null}
    </div>
  );
}
