import { fmtNum } from '../lib/units';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Award } from './Award';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { data } from '../lib/data';
import { hasBoard, rankBoard } from '../lib/board';
import { fmtValue, progress, status, unitOf } from '../lib/progress';
import { resultsOf } from '../lib/results';
import { lookOf } from '../lib/look';
import { addDays, fmtWindow, today } from '../lib/dates';
import { celebrate, encourage } from '../lib/celebrate';
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
/** Kind words for a challenge that wasn't completed, based on how far they got. */
function encouragement(r: Result): string {
  const p = Math.floor(r.pct);
  if (p >= 75) return `So close: ${p}% of the goal! You’re ready for the next one.`;
  if (p >= 40) return `You got ${p}% of the way. That’s real progress.`;
  if (r.value > 0) return `Every step counts, and you took ${r.c.category === 'habit' ? `${Math.round(r.value)} good days` : `${fmtValue(r.c, r.value)} ${unitOf(r.c)}`} of them.`;
  return 'Taking part is the first step. The next challenge is yours.';
}
/** One small, doable idea for next time. */
function nextStep(r: Result): string {
  if (r.c.category === 'habit') return 'Tip: set a daily reminder so you never miss a day.';
  if (r.activeDays <= 2) return 'Tip: a short walk on more days adds up fast.';
  return 'Tip: set a daily target to keep a steady pace.';
}


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
  // The challenge the member opened from a card ("See details"). The deck waits, then comes back.
  const [away, setAway] = useState<string | null>(null);
  const started = useRef(false);
  const opened = useRef(false);
  const arrived = useRef(false); // reached the challenge page (so a later path change means "came back")

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

  // Celebration: a big full-screen burst when the deck first opens, then one for each good result.
  const cur = deck?.[i];
  const hidden = !!away && loc.pathname === `/c/${away}`;
  useEffect(() => {
    if (!cur || hidden) return;
    const good = cur.done || (cur.rank !== null && cur.rank <= 3);
    // Good result → confetti. Not completed → an uplifting "keep going" rise (never sad).
    if (!opened.current) {
      opened.current = true;
      const a = setTimeout(() => (good ? celebrate(true) : encourage()), 250);
      const b = setTimeout(() => (good ? celebrate(true) : undefined), 900);
      return () => { clearTimeout(a); clearTimeout(b); };
    }
    const t = setTimeout(() => (good ? celebrate(true) : encourage()), 350);
    return () => clearTimeout(t);
  }, [cur, hidden]);

  // Back from the challenge page: carry on with the cards not seen yet.
  useEffect(() => {
    if (!away || !deck) return;
    if (loc.pathname === `/c/${away}`) { arrived.current = true; return; }
    if (!arrived.current) return; // still on the way there
    arrived.current = false;
    setAway(null);
    if (i + 1 >= deck.length) setDeck(null);
    else setI(i + 1);
  }, [away, deck, i, loc.pathname]);

  if (!deck || !user || setup || hidden) return null;

  const next = () => {
    const r = deck[i];
    if (r) markSeen(user.id, r.c.id);
    if (i + 1 >= deck.length) { setLeaving(true); setTimeout(() => setDeck(null), 280); }
    else setI(i + 1);
  };
  // ✕ closes for now; cards not seen yet come back next time the app opens.
  const closeForNow = () => { const r = deck[i]; if (r) markSeen(user.id, r.c.id); setLeaving(true); setTimeout(() => setDeck(null), 280); };
  const open = (r: Result) => { markSeen(user.id, r.c.id); setAway(r.c.id); nav(`/c/${r.c.id}`); };

  return (
    <div className={`rdeck${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-label="Your challenge results">
      <button className="rdeck-x" onClick={closeForNow} aria-label={deck.length - i > 1 ? 'Close (the other results show next time)' : 'Close'}><Icon name="x" /></button>
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
    ? `translate3d(${x}px, ${y + (enter ? 80 : 0)}px, 0) scale(${enter ? 0.7 : 1}) rotateZ(${x * 0.06}deg) rotateY(${x * 0.03}deg) rotateX(${-y * 0.03 + (enter ? 18 : 0)}deg)`
    : `translate3d(0, ${depth * 16}px, ${-depth * 40}px) scale(${1 - depth * 0.05})`;
  const dragging = !!drag.current;

  const completed = r.done;
  const podium = r.rank !== null && r.rank <= 3;
  const unit = unitOf(r.c);

  return (
    <div ref={el} className={`rcard${top ? ' top' : ''}`} style={{
      ['--c' as string]: look.color, transform: tf, opacity: fly ? 0 : enter && top ? 0 : 1 - depth * 0.25,
      transition: dragging ? 'none' : fly ? 'transform .42s cubic-bezier(.3,.6,.4,1), opacity .42s' : 'transform .55s cubic-bezier(.2,1.3,.35,1), opacity .3s',
      zIndex: 10 - depth,
    }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden={!top}>
      <div className="rcard-band">
        <span className="rcard-ic"><Icon name={look.icon} /></span>
        <span className="rcard-eyebrow">{completed ? 'Challenge complete' : podium ? 'On the podium' : 'Great effort'}</span>
      </div>
      <h2 className="rcard-title">{r.c.title}</h2>
      <p className="rcard-dates">{fmtWindow(r.c)}</p>

      <div className="rcard-hero">
        {podium ? (
          <Award c={r.c} place={r.rank!} size={104} />
        ) : r.rank !== null ? (
          <div className="rcard-rank"><b>#{r.rank}</b><span>of {r.of}</span></div>
        ) : (
          <div className={`rcard-badge${completed ? ' ok' : ' go'}`}>{completed ? <Icon name="check" /> : <div><b>{Math.floor(r.pct)}%</b><span>done</span></div>}</div>
        )}
      </div>

      <p className="rcard-head">
        {podium ? `You finished ${place(r.rank!)} of ${r.of}!` : completed ? 'Yes! You completed the challenge.' : r.rank !== null ? `You finished ${place(r.rank)} of ${r.of}. Nice work!` : 'You showed up. That’s a win!'}
      </p>
      <p className="rcard-sub">
        {completed ? (r.rank !== null && !podium ? 'You reached the goal. Great effort!' : 'You reached the goal. Well done!') : encouragement(r)}
      </p>

      {!completed ? <p className="rcard-tip">{nextStep(r)}</p> : null}

      <div className="rcard-stats">
        <div><b>{fmtValue(r.c, r.value)}</b><span>{r.c.category === 'habit' ? 'days done' : unit}</span></div>
        <div><b>{fmtNum(r.c.target)}</b><span>{r.c.category === 'habit' ? 'days goal' : 'goal'}</span></div>
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
