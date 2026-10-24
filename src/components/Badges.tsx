import { resultsOf } from '../lib/results';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { data } from '../lib/data';
import { hasBoard, rankBoard } from '../lib/board';
import { status } from '../lib/progress';
import { computeBadges, type Badge, type Placings } from '../lib/badges';

function Medal({ b, size = 64 }: { b: Badge; size?: number }) {
  return (
    <span className={`medal t-${b.tier} ${b.earned ? '' : 'locked'}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={b.icon} />
    </span>
  );
}

/** Finishing places from finished leaderboard challenges the member took part in. */
export function usePlacings(): Placings {
  const { challenges } = useStore();
  const { user } = useSession();
  const [placings, setPlacings] = useState<Placings>({});
  useEffect(() => {
    const done = challenges.filter((c) => c.joined && status(c) === 'finished' && hasBoard(c));
    if (!done.length || !user) return;
    let alive = true;
    Promise.all(done.map((c) => data.board(c.id).then((ps) => [c, ps] as const).catch(() => null))).then((rs) => {
      const p: Placings = {};
      for (const r of rs) {
        if (!r) continue;
        if (!resultsOf(r[0], r[1]).final) continue; // trophies only once every time zone has finished
        const rows = rankBoard(r[0], r[1], user.id);
        const i = rows.findIndex((x) => x.me);
        if (i >= 0 && rows[i].value > 0) p[r[0].id] = { rank: i + 1, of: rows.length };
      }
      if (alive) setPlacings(p);
    });
    return () => { alive = false; };
  }, [challenges, user]);
  return placings;
}

/** Profile badges: podium places, milestones, streaks and taking part. Earned first; locked ones show how to earn them. */
export function Badges({ full = false }: { full?: boolean }) {
  const nav = useNavigate();
  const { challenges, allActivities: activities, logs } = useStore();
  const [open, setOpen] = useState<Badge | null>(null);

  const placings = usePlacings();

  const badges = useMemo(() => computeBadges(challenges, activities, logs, placings), [challenges, activities, logs, placings]);
  const earned = badges.filter((b) => b.earned);
  const next = badges.filter((b) => !b.earned).sort((a, b) => (b.progress ? b.progress.now / b.progress.goal : 0) - (a.progress ? a.progress.now / a.progress.goal : 0));
  // Profile: one short row (earned first). Full screen: everything.
  const list = full ? [...earned, ...next] : [...earned, ...next].slice(0, 3);

  return (
    <section className="stack tight">
      <div className="sec-h">
        {full ? <span /> : <h2 className="h2">Badges</h2>}
        <span className="small muted">{earned.length} of {badges.length} earned</span>
      </div>
      <div className="card">
        {earned.length === 0 ? <p className="small muted" style={{ marginBottom: 12 }}>Join a challenge and log your first day to earn your first badge.</p> : null}
        <div className="badge-grid">
          {list.map((b) => (
            <button key={b.id} className="badge-cell" onClick={() => setOpen(b)} aria-label={`${b.name}${b.earned ? ', earned' : ', not earned yet'}`}>
              <Medal b={b} />
              <span className="bn">{b.name}</span>
              {!b.earned && b.progress && b.progress.goal > 1 ? <span className="bp">{b.progress.now}/{b.progress.goal}</span> : null}
            </button>
          ))}
        </div>
        {!full ? <button className="link-btn" style={{ width: '100%' }} onClick={() => nav('/badges')}>See all {badges.length} badges</button> : null}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} label={open?.name ?? 'Badge'}>
        {open ? (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', paddingBottom: 8 }}>
            <Medal b={open} size={96} />
            <p className="eyebrow">{open.group}</p>
            <h2 className="h1" style={{ fontSize: 26 }}>{open.name}</h2>
            <p className="lead">{open.earned ? (open.detail ?? 'Earned. Well done!') : open.how}</p>
            {!open.earned && open.progress && open.progress.goal > 1 ? (
              <div style={{ width: '100%' }} className="stack tight">
                <div className="bar" style={{ ['--c' as string]: 'var(--good)' }}><i style={{ width: `${(open.progress.now / open.progress.goal) * 100}%` }} /></div>
                <p className="small muted">{open.progress.now} of {open.progress.goal}. Keep going, you’re on your way!</p>
              </div>
            ) : null}
            {open.earned ? <p className="small muted">{open.how}</p> : null}
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
