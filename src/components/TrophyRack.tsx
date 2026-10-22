import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, type Tier } from './Trophy';
import { usePlacings } from './Badges';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { hasBoard } from '../lib/board';
import { status } from '../lib/progress';
import { addDays, fmtDay, today } from '../lib/dates';

type Cup = { id: string; title: string; tier: Tier; rank: 1 | 2 | 3; of: number; end: string; sample?: boolean };
const ORD = { 1: '1st', 2: '2nd', 3: '3rd' } as const;
const TIER = { 1: 'gold', 2: 'silver', 3: 'bronze' } as const;
const PER_ROW = 3;
const SHOWN = 6; // two shelves before "Show all"

/** Preview trophies, shown only to the app owner so he can see a full cabinet. Remove when real ones exist. */
const PREVIEW_FOR = ['swaran2596@gmail.com'];
const SAMPLES: [string, 1 | 2 | 3, number][] = [
  ['Diwali 10K walk', 1, 42], ['Morning run streak', 2, 31], ['Hydration week', 1, 58], ['Weekend ride 50', 3, 19],
  ['5K easy walk', 2, 64], ['Sleep by 11', 1, 27], ['Gurpurab steps', 3, 80], ['Monsoon miles', 2, 22],
  ['Early riser', 1, 35], ['Sangat cycle', 3, 17],
];

/**
 * Trophy cabinet: one trophy for every finished leaderboard challenge where the member came 1st, 2nd or 3rd.
 * Kept quiet on purpose — card surface, hairline shelves — so it sits with the rest of the profile.
 */
export function TrophyRack() {
  const nav = useNavigate();
  const { challenges } = useStore();
  const { user } = useSession();
  const placings = usePlacings();
  const [all, setAll] = useState(false);

  const real: Cup[] = challenges
    .filter((c) => c.joined && status(c) === 'finished' && hasBoard(c))
    .map((c): Cup | null => {
      const pl = placings[c.id];
      if (!pl || pl.rank > 3) return null;
      const r = pl.rank as 1 | 2 | 3;
      return { id: c.id, title: c.title, tier: TIER[r], rank: r, of: pl.of, end: c.end_date };
    })
    .filter((x): x is Cup => !!x);

  const preview = !!user?.email && PREVIEW_FOR.includes(user.email.toLowerCase());
  const samples: Cup[] = preview
    ? SAMPLES.map(([title, rank, of], i) => ({ id: `sample-${i}`, title, rank, of, tier: TIER[rank], end: addDays(today(), -9 * (i + 1)), sample: true }))
    : [];

  const cups = [...real, ...samples].sort((a, b) => a.rank - b.rank || b.end.localeCompare(a.end));
  const shown = all ? cups : cups.slice(0, SHOWN);
  const count = (r: 1 | 2 | 3) => cups.filter((c) => c.rank === r).length;

  const rows: (Cup | null)[][] = [];
  if (!cups.length) rows.push([null, null, null]);
  for (let i = 0; i < shown.length; i += PER_ROW) rows.push(Array.from({ length: PER_ROW }, (_, k) => shown[i + k] ?? null));

  return (
    <section className="stack tight">
      <div className="sec-h">
        <h2 className="h2">Trophies</h2>
        {cups.length ? (
          <span className="tally" aria-label={`${count(1)} gold, ${count(2)} silver, ${count(3)} bronze`}>
            <span><i className="t-g" />{count(1)}</span><span><i className="t-s" />{count(2)}</span><span><i className="t-b" />{count(3)}</span>
          </span>
        ) : null}
      </div>
      <div className="cabinet">
        {rows.map((row, ri) => (
          <div key={ri} className="cab-row">
            <div className="cab-slots">
              {row.map((c, i) => c ? (
                <button key={c.id} className={`cup r${c.rank}`} disabled={c.sample} onClick={() => !c.sample && nav(`/c/${c.id}`)}
                  aria-label={`${ORD[c.rank]} place in ${c.title}, out of ${c.of}${c.sample ? ' (sample)' : ''}`}>
                  <span className="glow" aria-hidden="true" />
                  <Trophy tier={c.tier} rank={c.rank} size={c.rank === 1 ? 56 : 50} />
                  <span className="plaque"><b>{c.title}</b><i>{ORD[c.rank]} of {c.of} · {fmtDay(c.end)}</i></span>
                </button>
              ) : cups.length ? <div key={`e${ri}${i}`} aria-hidden="true" /> : (
                <div key={`e${ri}${i}`} className="cup empty" aria-hidden="true"><Trophy tier="silver" size={46} /></div>
              ))}
            </div>
            <div className="cab-shelf" aria-hidden="true" />
          </div>
        ))}
        {!cups.length ? <p className="cab-note">Finish 1st, 2nd or 3rd on a challenge leaderboard to win your first trophy.</p> : null}
        {cups.length > SHOWN ? (
          <button className="link-btn cab-more" onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? 'Show fewer' : `Show all ${cups.length} trophies`}
          </button>
        ) : null}
      </div>
      {samples.length ? <p className="tiny muted" style={{ textAlign: 'center' }}>Sample trophies for preview. Only you can see these.</p> : null}
    </section>
  );
}
