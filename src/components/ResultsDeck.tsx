import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Trophy, type Tier } from './Trophy';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { data } from '../lib/data';
import { hasBoard, rankBoard } from '../lib/board';
import { fmtValue, progress, status, unitOf } from '../lib/progress';
import { resultsOf } from '../lib/results';
import { lookOf } from '../lib/look';
import { addDays, fmtWindow, today } from '../lib/dates';
import { celebrate } from '../lib/celebrate';
import type { Challenge } from '../lib/types';

/** One finished challenge, ready to show on a card. */
type Result = {
  c: Challenge;
  rank: number | null; // leaderboard place, or null when the challenge has no leaderboard
  of: number;
  value: number;
  pct: number;
  done: boolean;
  activeDays: number;
};

const place = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const TIER: Record<number, Tier> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

const seenKey = (uid: string) => `ndf-results-seen-${uid}`;
const readSeen = (uid: string): string[] => { try { return JSON.parse(localStorage.getItem(seenKey(uid)) || '[]'); } catch { return []; } };
const markSeen = (uid: string, id: string) => { try { localStorage.setItem(seenKey(uid), JSON.stringify([...new Set([...readSeen(uid), id])].slice(-200))); } catch { /* ignore */ } };

/**
 * When the member opens the app after a challenge they took part in has ended (and the results are final
 * in every member's time zone), show one card per challenge with their place and a few stats.
 * Swipe a card in any direction (or tap Next) and it flies away; the next one comes forward.
 */
export function ResultsDeck() {
  const nav = useNavigate();
  const { user, needsProfile, profile } = useSession();
  const loc = useLocation();
  const { challenges, allActivities, logs, loading } = useStore();
  // Not during sign-up / profile setup.
  const setup = needsProfile || !profile?.password_set || ['/about', '/set-password'].includes(loc.pathname);
  const [deck, setDeck] = useState<Result[] | null>(null);
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(false);

  // Build the deck once per app open, after challenges have loaded.
  useEffect(() => {
    if (!user || setup || loading || started.current || !challenges.length) return;
    started.current = true;
    const seen = readSeen(user.id);
    const recent = addDays(today(), -21);
    const cands = challenges.filter((c) => c.joined && status(c) === 'finished' && c.end_date >= recent && !seen.includes(c.id));
    if (!cands.length) return;
    Promise.all(cands.map(async (c): Promise<Result | null> => {
      try {
        const ps = await data.board(c.id);
        if (!resultsOf(c, ps).final) return null; // still waiting for other time zones
        const p = progress(c, allActivities, logs);
        let rank: number | null = null;
        if (hasBoard(c)) { const rows = rankBoard(c, ps, user.id); const k = rows.findIndex((r) => r.me); rank = k >= 0 && rows[k].value > 0 ? k + 1 : null; }
        const days = c.category === 'habit' ? p.metDays.length : new Set(p.counted.map((a) => a.date)).size;
        return { c, rank, of: ps.length, value: p.value, pct: p.pct, done: p.done, activeDays: days };
      } catch { return null; }
    })).then((rs) => {
      const list = rs.filter((r): r is Result => !!r).sort((a, b) => b.c.end_date.localeCompare(a.c.end_date));
      if (list.length) setDeck(list);
    });
  }, [user, setup, loading, challenges, allActivities, logs]);

  // Confetti for each good result as it comes to the front.
  const cur = deck?.[i];
  useEffect(() => {
    if (!cur) return;
    if (cur.done || (cur.rank !== null && cur.rank <= 3)) { const t = setTimeout(() => celebrate(true), 350); return () => clearTimeout(t); }
  }, [cur]);

  if (!deck || !user || setup) return null;

  const next = () => {
    const r = deck[i];
    if (r) markSeen(user.id, r.c.id);
    if (i + 1 >= deck.length) { setLeaving(true); setTimeout(() => setDeck(null), 280); }
    else setI(i + 1);
  };
  const closeAll = () => { deck.forEach((r) => markSeen(user.id, r.c.id)); setLeaving(true); setTimeout(() => setDeck(null), 280); };
  const open = (r: Result) => { closeAll(); nav(`/c/${r.c.id}`); };

  return (
    <div className={`rdeck${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-label="Your challenge results">
      <button className="rdeck-x" onClick={closeAll} aria-label="Close all results"><Icon name="x" /></button>
      <div className="rdeck-stack">
        {deck.slice(i, i + 3).map((r, k) => (
          <ResultCard key={r.c.id} r={r} depth={k} top={k === 0} last={i + k === deck.length - 1} onGone={next} onOpen={() => open(r)} />
        )).reverse()}
      </div>
      <p className="rdeck-hint" aria-live="polite">{deck.length > 1 ? `${i + 1} of ${deck.length} · ` : ''}Swipe the card away</p>
    </div>
  );
}

function ResultCard({ r, depth, top, last, onGone, onOpen }: { r: Result; depth: number; top: boolean; last: boolean; onGone: () => void; onOpen: () => void }) {
  const look = lookOf(r.c);
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [fly, setFly] = useState<{ x: number; y: number } | null>(null);
  const [enter, setEnter] = useState(true);
  useEffect(() => { const t = requestAnimationFrame(() => setEnter(false)); return () => cancelAnimationFrame(t); }, []);

  const throwAway = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy) || 1;
    const far = Math.max(window.innerWidth, window.innerHeight) * 1.3;
    setFly({ x: (dx / len) * far, y: (dy / len) * far });
    setTimeout(onGone, 380);
  };

  const down = (e: RPointerEvent) => {
    if (!top || fly || (e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    el.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent) => { const d = drag.current; if (d) setPos({ x: e.clientX - d.x, y: e.clientY - d.y }); };
  const up = (e: RPointerEvent) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Math.max(1, performance.now() - d.t);
    const fast = Math.hypot(dx, dy) / dt > 0.6;
    if (Math.hypot(dx, dy) > 110 || (fast && Math.hypot(dx, dy) > 30)) throwAway(dx, dy);
    else setPos({ x: 0, y: 0 });
  };

  const x = fly ? fly.x : pos.x, y = fly ? fly.y : pos.y;
  const tf = top
    ? `translate3d(${x}px, ${y + (enter ? 60 : 0)}px, 0) rotateZ(${x * 0.06}deg) rotateY(${x * 0.03}deg) rotateX(${-y * 0.03}deg)`
    : `translate3d(0, ${depth * 16}px, ${-depth * 40}px) scale(${1 - depth * 0.05})`;
  const dragging = !!drag.current;

  const completed = r.done;
  const podium = r.rank !== null && r.rank <= 3;
  const unit = unitOf(r.c);

  return (
    <div ref={el} className={`rcard${top ? ' top' : ''}`} style={{
      ['--c' as string]: look.color, transform: tf, opacity: fly ? 0 : enter && top ? 0 : 1 - depth * 0.25,
      transition: dragging ? 'none' : fly ? 'transform .42s cubic-bezier(.3,.6,.4,1), opacity .42s' : 'transform .38s cubic-bezier(.2,.9,.3,1.15), opacity .3s',
      zIndex: 10 - depth,
    }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden={!top}>
      <div className="rcard-band">
        <span className="rcard-ic"><Icon name={look.icon} /></span>
        <span className="rcard-eyebrow">{completed ? 'Challenge complete' : 'Challenge finished'}</span>
      </div>
      <h2 className="rcard-title">{r.c.title}</h2>
      <p className="rcard-dates">{fmtWindow(r.c)}</p>

      <div className="rcard-hero">
        {podium ? (
          <Trophy tier={TIER[r.rank!]} rank={r.rank!} size={96} />
        ) : r.rank !== null ? (
          <div className="rcard-rank"><b>#{r.rank}</b><span>of {r.of}</span></div>
        ) : (
          <div className={`rcard-badge${completed ? ' ok' : ''}`}>{completed ? <Icon name="check" /> : <b>{Math.floor(r.pct)}%</b>}</div>
        )}
      </div>

      <p className="rcard-head">
        {podium ? `You finished ${place(r.rank!)} of ${r.of}!` : completed ? 'Yes! You completed the challenge.' : r.rank !== null ? `You finished ${place(r.rank)} of ${r.of}.` : 'Well done for taking part.'}
      </p>
      <p className="rcard-sub">
        {completed ? (r.rank !== null && !podium ? 'You reached the goal. Great effort!' : 'You reached the goal. Well done!') : `You reached ${Math.floor(r.pct)}% of the goal. Every step counts.`}
      </p>

      <div className="rcard-stats">
        <div><b>{fmtValue(r.c, r.value)}</b><span>{r.c.category === 'habit' ? 'days done' : unit}</span></div>
        <div><b>{r.c.target}</b><span>{r.c.category === 'habit' ? 'days goal' : 'goal'}</span></div>
        {r.c.category === 'habit'
          ? <div><b>{Math.min(100, Math.floor(r.pct))}%</b><span>of goal</span></div>
          : <div><b>{r.activeDays}</b><span>{r.activeDays === 1 ? 'active day' : 'active days'}</span></div>}
      </div>

      <div className="rcard-actions">
        <button className="btn ghost" onClick={onOpen}>See details</button>
        <button className="btn" onClick={() => throwAway(0, -1)}>{last ? 'Done' : 'Next'}{last ? null : <Icon name="chev" />}</button>
      </div>
    </div>
  );
}
