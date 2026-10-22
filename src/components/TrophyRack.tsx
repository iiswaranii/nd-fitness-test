import { useNavigate } from 'react-router-dom';
import { Trophy, type Tier } from './Trophy';
import { usePlacings } from './Badges';
import { useStore } from '../lib/store';
import { progress, status } from '../lib/progress';

type Cup = { id: string; title: string; tier: Tier; rank?: number; what: string; end: string };
const ORD = ['', '1st', '2nd', '3rd'];

/**
 * Trophies on wooden shelves: a gold / silver / bronze cup for each podium finish, and a blue cup for each
 * challenge completed. Empty spots show what's still to win.
 */
export function TrophyRack() {
  const nav = useNavigate();
  const { challenges, activities, logs } = useStore();
  const placings = usePlacings();

  const cups: Cup[] = challenges
    .filter((c) => c.joined && status(c) === 'finished')
    .map((c): Cup | null => {
      const pl = placings[c.id];
      if (pl && pl.rank <= 3) {
        return { id: c.id, title: c.title, tier: pl.rank === 1 ? 'gold' : pl.rank === 2 ? 'silver' : 'bronze', rank: pl.rank, what: `${ORD[pl.rank]} of ${pl.of}`, end: c.end_date };
      }
      if (progress(c, activities, logs).done) return { id: c.id, title: c.title, tier: 'blue', what: 'Completed', end: c.end_date };
      return null;
    })
    .filter((x): x is Cup => !!x)
    .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9) || b.end.localeCompare(a.end));

  const slots = Math.max(3, Math.ceil(cups.length / 3) * 3);
  const golds = cups.filter((c) => c.tier === 'gold').length;

  return (
    <section className="stack tight">
      <div className="sec-h">
        <h2 className="h2">Trophy rack</h2>
        <span className="small muted">{cups.length ? `${cups.length} ${cups.length === 1 ? 'trophy' : 'trophies'}${golds ? ` · ${golds} gold` : ''}` : 'No trophies yet'}</span>
      </div>
      <div className="card">
        <div className="rack">
          {Array.from({ length: slots }).map((_, i) => {
            const c = cups[i];
            const slot = c ? (
              <button key={c.id} className="slot" onClick={() => nav(`/c/${c.id}`)} aria-label={`${c.title}: ${c.what}`}>
                <Trophy tier={c.tier} rank={c.rank} size={c.rank === 1 ? 60 : 52} />
                <span className="tn">{c.title}</span>
                <span className="tm">{c.what}</span>
              </button>
            ) : (
              <div key={`e${i}`} className="slot empty" aria-hidden="true"><Trophy tier="gold" size={52} /><span className="tn">&nbsp;</span></div>
            );
            return (i + 1) % 3 === 0 ? [slot, <div key={`s${i}`} className="shelf" />] : slot;
          })}
        </div>
        {!cups.length ? <p className="small muted" style={{ textAlign: 'center' }}>Finish a challenge to put your first trophy here. A top‑3 place earns gold, silver or bronze.</p> : null}
      </div>
    </section>
  );
}
