import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlacings } from './Badges';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { hasBoard } from '../lib/board';
import { status, totalDays } from '../lib/progress';
import { lookOf } from '../lib/look';
import { awardSvg, type AwardKind } from '../lib/award';
import { addDays, fmtRange, today } from '../lib/dates';

type Cup = {
  id: string; title: string; rank: 1 | 2 | 3; of: number; start: string; end: string; kind: AwardKind; icon?: string;
  total?: string; days?: number; length: number; sample?: boolean;
};
const ORD = { 1: '1st', 2: '2nd', 3: '3rd' } as const;
const METAL = { 1: 'gold', 2: 'silver', 3: 'bronze' } as const;
const KIND_NAME: Record<AwardKind, string> = { walk: 'Walk', run: 'Run', ride: 'Ride', habit: 'Habit', coin: '' };
const SHOW = 3;

/** Preview trophies, shown only to the app owner so he can see a full cabinet. Remove when real ones exist. */
const PREVIEW_FOR = ['swaran2596@gmail.com'];
const SAMPLES: [string, 1 | 2 | 3, number, AwardKind, string, number, string?][] = [
  ['Diwali 10K walk', 1, 42, 'walk', '12.40 km', 7], ['Morning run streak', 2, 31, 'run', '38.20 km', 12], ['Hydration week', 1, 58, 'habit', '7 days', 7, 'drop'],
  ['Weekend ride 50', 3, 19, 'ride', '61.50 km', 4], ['5K easy walk', 2, 64, 'walk', '5.80 km', 3], ['Sleep by 11', 1, 27, 'habit', '14 days', 14, 'moon'],
  ['Gurpurab steps', 3, 80, 'walk', '44.10 km', 18], ['Monsoon miles', 2, 22, 'run', '27.00 km', 9], ['Early riser', 1, 35, 'habit', '21 days', 21, 'sun'],
  ['Sangat cycle', 3, 17, 'ride', '48.90 km', 5],
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
        return {
          id: c.id, title: c.title, rank: pl.rank as 1 | 2 | 3, of: pl.of, start: c.start_date, end: c.end_date, kind,
          icon: kind === 'habit' ? lookOf(c).icon : undefined, total: pl.label, days: pl.days, length: totalDays(c),
        };
      })
      .filter((x): x is Cup => !!x);
    const preview = !!user?.email && PREVIEW_FOR.includes(user.email.toLowerCase());
    const samples: Cup[] = preview
      ? SAMPLES.map(([title, rank, of, kind, total, days, icon], i) => {
        const end = addDays(today(), -9 * (i + 1));
        const len = kind === 'habit' ? days : Math.max(days, 7 + (i % 3) * 7);
        return { id: `sample-${i}`, title, rank, of, kind, icon, total, days, end, start: addDays(end, -(len - 1)), length: len, sample: true };
      })
      : [];
    return { cups: [...real, ...samples].sort((a, b) => a.rank - b.rank || b.end.localeCompare(a.end)), samples: samples.length > 0 };
  }, [challenges, placings, user]);
}

function CupArt({ c }: { c: Cup }) {
  const svg = useMemo(() => awardSvg({ kind: c.kind, metal: METAL[c.rank], rank: c.rank, icon: c.icon }), [c.kind, c.rank, c.icon]);
  return <span className="cup-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/**
 * Trophies: a simple grid of cups. Tap one for a small card with the challenge and how you did.
 * Profile shows the best three; "See all" opens the full cabinet.
 */
export function TrophyRack({ full = false }: { full?: boolean }) {
  const nav = useNavigate();
  const { cups, samples } = useCups();
  const [open, setOpen] = useState<Cup | null>(null);
  const count = (r: 1 | 2 | 3) => cups.filter((c) => c.rank === r).length;
  const shown = full ? cups : cups.slice(0, SHOW);

  const tally = cups.length ? (
    <span className="tally" aria-label={`${count(1)} gold, ${count(2)} silver, ${count(3)} bronze`}>
      <span><i className="t-g" />{count(1)}</span><span><i className="t-s" />{count(2)}</span><span><i className="t-b" />{count(3)}</span>
    </span>
  ) : null;

  return (
    <section className={`stack${full ? '' : ' tight'}`}>
      <div className="sec-h">{full ? <span className="small muted">{cups.length ? `${cups.length} ${cups.length === 1 ? 'trophy' : 'trophies'}` : ''}</span> : <h2 className="h2">Trophies</h2>}{tally}</div>
      {cups.length ? (
        <div className="card cups">
          {shown.map((c) => (
            <button key={c.id} className="cup-btn" onClick={() => setOpen(c)} aria-label={`${ORD[c.rank]} place in ${c.title}. Show details`}>
              <CupArt c={c} />
              <b>{c.title}</b>
              <span>{ORD[c.rank]} of {c.of}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card cups-empty">
          <span className="cups-ghost" aria-hidden="true"><Icon name="trophy" /></span>
          <p className="small muted">Finish 1st, 2nd or 3rd on a challenge leaderboard to win your first trophy.</p>
        </div>
      )}
      {!full && cups.length > SHOW ? (
        <button className="link-btn" style={{ width: '100%' }} onClick={() => nav('/trophies')}>See all {cups.length} trophies</button>
      ) : null}
      {samples ? <p className="tiny muted" style={{ textAlign: 'center' }}>Sample trophies for preview. Only you can see these.</p> : null}

      <Sheet open={!!open} onClose={() => setOpen(null)} label={open ? `${ORD[open.rank]} place, ${open.title}` : 'Trophy'}>
        {open ? (
          <div className="stack cup-sheet">
            <div className={`cup-hero r${open.rank}`}><CupArt c={open} /></div>
            <p className="eyebrow">{ORD[open.rank]} place · {KIND_NAME[open.kind]} challenge</p>
            <h2 className="h1" style={{ fontSize: 26 }}>{open.title}</h2>
            <p className="small muted">{fmtRange(open.start, open.end)}</p>
            <div className="cup-stats">
              <div><span>Place</span><b>{ORD[open.rank]}</b><em>of {open.of}</em></div>
              {open.kind !== 'habit' && open.total ? <div><span>Your total</span><b>{open.total}</b></div> : null}
              <div><span>Days logged</span><b>{open.days ?? '—'}</b><em>of {open.length}</em></div>
            </div>
            {open.sample
              ? <p className="tiny muted">Sample trophy. Real ones open their challenge.</p>
              : <button className="btn" onClick={() => { const id = open.id; setOpen(null); nav(`/c/${id}`); }}>View challenge</button>}
          </div>
        ) : null}
      </Sheet>
    </section>
  );
}
