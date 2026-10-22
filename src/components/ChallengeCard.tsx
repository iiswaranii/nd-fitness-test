import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Bar } from './Ring';
import { useStore } from '../lib/store';
import { lookOf } from '../lib/look';
import { audienceText, hasAudience } from '../lib/audience';
import { canJoin, dayText, fmtValue, goalText, progress, regOpen, status, unitOf } from '../lib/progress';
import { fmtDay, fmtRange } from '../lib/dates';
import type { Challenge } from '../lib/types';

export function StatusPill({ c, done }: { c: Challenge; done?: boolean }) {
  const st = status(c);
  if (st === 'cancelled') return <span className="pill bad">Cancelled</span>;
  if (st === 'finished') return done ? <span className="pill good"><Icon name="check" className="ic" />Completed</span> : <span className="pill">Ended</span>;
  if (st === 'upcoming') return <span className="pill warn">Upcoming</span>;
  return <span className="pill good">Live</span>;
}

/** Card for a joined, active or finished challenge: progress bar and numbers. */
export function ChallengeCard({ c }: { c: Challenge }) {
  const nav = useNavigate();
  const { allActivities: activities, logs, newIds } = useStore();
  const look = lookOf(c);
  const st = status(c);
  const p = c.joined && st !== 'upcoming' ? progress(c, activities, logs) : null;
  return (
    <button className={`card cc ${newIds.has(c.id) ? 'is-new' : ''}`} style={{ ['--c' as string]: look.color }} onClick={() => nav(`/c/${c.id}`)}>
      <div className="cc-top">
        <span className="sp"><Icon name={look.icon} /></span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="cc-t" style={{ display: 'block' }}>{c.title}</span>
          <span className="cc-s">{look.kind} · {fmtRange(c.start_date, c.end_date)}</span>
        </span>
        {p && st === 'active' ? <span className="pill c">{p.done ? 'Done' : `${Math.floor(p.pct)}%`}</span> : <StatusPill c={c} done={p?.done} />}
      </div>
      {p ? (
        <>
          <Bar pct={p.pct} color={look.color} />
          <div className="cc-n">
            <span><b>{fmtValue(c, p.value)}</b> <span className="muted">/ {c.target} {unitOf(c)}</span></span>
            <span className="muted">{p.done ? 'Goal complete' : st === 'active' ? dayText(c) : st === 'finished' ? 'Ended' : ''}</span>
          </div>
        </>
      ) : (
        <div className="cc-n"><span className="muted">{goalText(c)}</span>{st === 'upcoming' && c.joined ? <span className="muted">Starts {fmtDay(c.start_date)}</span> : null}</div>
      )}
    </button>
  );
}

/** Card for a challenge the member can join (or will be able to soon). Tinted, with a big Join button. */
export function OpenCard({ c, onJoin }: { c: Challenge; onJoin: (c: Challenge) => void }) {
  const nav = useNavigate();
  const { newIds, markSeen } = useStore();
  // Keep the badge for this visit, but count the challenge as seen once it has been on screen for a moment.
  const [isNew] = useState(() => newIds.has(c.id));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!isNew || !el || typeof IntersectionObserver === 'undefined') return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) t = setTimeout(() => { markSeen(c.id); io.disconnect(); }, 1200);
      else if (t) clearTimeout(t);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); if (t) clearTimeout(t); };
  }, [isNew, c.id, markSeen]);
  const look = lookOf(c);
  const st = status(c);
  const can = canJoin(c);
  return (
    <div ref={ref} className={`card cc open ${isNew ? 'is-new' : ''}`} style={{ ['--c' as string]: look.color }}>
      <button className="cc-top" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', width: '100%' }} onClick={() => nav(`/c/${c.id}`)}>
        <span className="sp"><Icon name={look.icon} /></span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="cc-t" style={{ display: 'block' }}>{c.title}</span>
          <span className="cc-s">{look.kind} · {fmtRange(c.start_date, c.end_date)}</span>
        </span>
        {isNew ? <span className="pill new">New</span> : <StatusPill c={c} />}
      </button>
      <p className="small" style={{ color: 'var(--ink-2)' }}>{goalText(c)}</p>
      {hasAudience(c) ? <span className="aud-tag" style={{ alignSelf: 'flex-start' }}><Icon name="users" />Specially for {audienceText(c)}</span> : null}
      {!c.eligible ? <p className="small muted">This one is only for {audienceText(c)}. You can follow along and see the leaderboard, but you can’t join.</p> : null}
      <div className="meta">
        <Icon name="users" className="ic" />
        <span className="strong" style={{ fontSize: 13.5 }}>{c.member_count ? `${c.member_count} joined` : 'Be the first to join'}</span>
        <span className="muted" style={{ marginLeft: 'auto', fontWeight: 600 }}>
          {!c.eligible ? 'View only' : can ? `Join by ${fmtDay(c.join_by)}` : !regOpen(c) ? `Starts ${fmtDay(c.start_date)}` : 'Enrolment closed'}
        </span>
      </div>
      {!c.eligible ? (
        <button className="btn ghost" onClick={() => nav(`/c/${c.id}`)}><Icon name="eye" />View challenge</button>
      ) : can ? (
        <button className="btn tint" onClick={() => { markSeen(c.id); onJoin(c); }}><Icon name="plus" />Join challenge</button>
      ) : !regOpen(c) && st !== 'finished' ? (
        <button className="btn ghost" onClick={() => nav(`/c/${c.id}`)}><Icon name="cal" />Registration opens {fmtDay(c.reg_opens)}</button>
      ) : null}
    </div>
  );
}
