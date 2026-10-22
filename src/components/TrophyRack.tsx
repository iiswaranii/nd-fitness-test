import { useNavigate } from 'react-router-dom';
import { Trophy, type Tier } from './Trophy';
import { usePlacings } from './Badges';
import { useStore } from '../lib/store';
import { hasBoard } from '../lib/board';
import { status } from '../lib/progress';
import { fmtDay } from '../lib/dates';

type Cup = { id: string; title: string; tier: Tier; rank: 1 | 2 | 3; of: number; end: string };
const ORD = { 1: '1st', 2: '2nd', 3: '3rd' } as const;
const TIER = { 1: 'gold', 2: 'silver', 3: 'bronze' } as const;

/**
 * Trophy cabinet: one trophy for every finished leaderboard challenge where the member came 1st, 2nd or 3rd.
 * Gold / silver / bronze, with the place on the cup and on a ribbon above it.
 */
export function TrophyRack() {
  const nav = useNavigate();
  const { challenges } = useStore();
  const placings = usePlacings();

  const cups: Cup[] = challenges
    .filter((c) => c.joined && status(c) === 'finished' && hasBoard(c))
    .map((c): Cup | null => {
      const pl = placings[c.id];
      if (!pl || pl.rank > 3) return null;
      const r = pl.rank as 1 | 2 | 3;
      return { id: c.id, title: c.title, tier: TIER[r], rank: r, of: pl.of, end: c.end_date };
    })
    .filter((x): x is Cup => !!x)
    .sort((a, b) => a.rank - b.rank || b.end.localeCompare(a.end));

  const count = (r: 1 | 2 | 3) => cups.filter((c) => c.rank === r).length;
  const rows: (Cup | null)[][] = [];
  const slots = Math.max(3, Math.ceil(cups.length / 3) * 3);
  for (let i = 0; i < slots; i += 3) rows.push([0, 1, 2].map((k) => cups[i + k] ?? null));

  return (
    <section className="stack tight">
      <div className="sec-h">
        <h2 className="h2">Trophy cabinet</h2>
        {cups.length ? (
          <span className="tally" aria-label={`${count(1)} gold, ${count(2)} silver, ${count(3)} bronze`}>
            <span className="t-g">{count(1)}</span><span className="t-s">{count(2)}</span><span className="t-b">{count(3)}</span>
          </span>
        ) : null}
      </div>
      <div className="cabinet">
        {rows.map((row, ri) => (
          <div key={ri} className="cab-row">
            <div className="cab-slots">
              {row.map((c, i) => c ? (
                <button key={c.id} className={`cup r${c.rank}`} onClick={() => nav(`/c/${c.id}`)} aria-label={`${ORD[c.rank]} place in ${c.title}, out of ${c.of}`}>
                  <span className="glow" aria-hidden="true" />
                  <span className="ribbon">{c.rank}</span>
                  <Trophy tier={c.tier} rank={c.rank} size={c.rank === 1 ? 66 : 58} />
                  <span className="plaque"><b>{c.title}</b><i>{ORD[c.rank]} of {c.of} · {fmtDay(c.end)}</i></span>
                </button>
              ) : (
                <div key={`e${ri}${i}`} className="cup empty" aria-hidden="true"><Trophy tier="silver" size={54} /><span className="plaque"><b>&nbsp;</b><i>&nbsp;</i></span></div>
              ))}
            </div>
            <div className="cab-shelf" />
          </div>
        ))}
        {!cups.length ? (
          <p className="cab-note">Finish 1st, 2nd or 3rd on a challenge leaderboard to put your first trophy here.</p>
        ) : null}
      </div>
    </section>
  );
}
