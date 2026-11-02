import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Trophy, type Tier } from './Trophy';
import { useSession } from '../lib/session';
import { data } from '../lib/data';
import { hasBoard, rankBoard } from '../lib/board';
import { fmtValue, goalText, unitOf, type Progress } from '../lib/progress';
import { resultsOf } from '../lib/results';
import { fmtMoment, fmtWindow } from '../lib/dates';
import { habitByKey, habitGoalText } from '../lib/habits';
import { lookOf } from '../lib/look';
import type { Challenge } from '../lib/types';

const place = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const TIER: Record<number, Tier> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/**
 * A finished challenge, kept short: your result, how many took part (a count, not a list),
 * and a few lines about the challenge.
 */
export function FinishedSummary({ c, p }: { c: Challenge; p: Progress | null }) {
  const { user } = useSession();
  const [info, setInfo] = useState<{ members: number; rank: number | null; final: boolean; at: number } | null>(null);
  useEffect(() => {
    let alive = true;
    data.board(c.id).then((ps) => {
      if (!alive) return;
      const res = resultsOf(c, ps);
      let rank: number | null = null;
      if (hasBoard(c) && user) { const rows = rankBoard(c, ps, user.id); const k = rows.findIndex((r) => r.me); rank = k >= 0 && rows[k].value > 0 ? k + 1 : null; }
      setInfo({ members: ps.length, rank, final: res.final, at: res.at });
    }).catch(() => alive && setInfo({ members: c.member_count, rank: null, final: true, at: 0 }));
    return () => { alive = false; };
  }, [c, user]);

  const look = lookOf(c);
  const h = habitByKey(c.habit_key);
  const board = hasBoard(c);
  const members = info?.members ?? c.member_count;
  const days = p ? (c.category === 'habit' ? p.metDays.length : new Set(p.counted.map((a) => a.date)).size) : 0;
  const waiting = info && !info.final;

  return (
    <>
      {p ? (
        <section className="card fsum" style={{ ['--c' as string]: look.color }}>
          <p className="eyebrow">Your result</p>
          <div className="fsum-top">
            {board && info?.rank && !waiting ? (
              info.rank <= 3 ? <Trophy tier={TIER[info.rank]} rank={info.rank} size={64} /> : <div className="fsum-rank">#{info.rank}</div>
            ) : (
              <div className={`fsum-badge${p.done ? ' ok' : ''}`}>{p.done ? <Icon name="check" /> : <b>{Math.floor(p.pct)}%</b>}</div>
            )}
            <div style={{ minWidth: 0 }}>
              <p className="fsum-head">
                {waiting ? 'Final results coming soon'
                  : board && info?.rank ? `${place(info.rank)} of ${members}`
                  : p.done ? 'Challenge completed' : 'You took part!'}
              </p>
              <p className="small muted">
                {waiting ? `Final at ${fmtMoment(new Date(info!.at).toISOString())}`
                  : p.done ? 'You reached the goal. Well done!' : `Great effort: ${Math.floor(p.pct)}% of the goal. Keep going!`}
              </p>
            </div>
          </div>
          <div className="fsum-stats">
            <div><b>{fmtValue(c, p.value)}</b><span>{c.category === 'habit' ? 'days done' : unitOf(c)}</span></div>
            <div><b>{c.target}</b><span>{c.category === 'habit' ? 'days goal' : 'goal'}</span></div>
            {c.category === 'habit'
              ? <div><b>{Math.min(100, Math.floor(p.pct))}%</b><span>of goal</span></div>
              : <div><b>{days}</b><span>{days === 1 ? 'active day' : 'active days'}</span></div>}
          </div>
        </section>
      ) : (
        <div className="card row" style={{ gap: 12 }}><span className="sp"><Icon name="eye" /></span><p className="small muted">You didn’t take part in this challenge.</p></div>
      )}

      <div className="card fsum-members">
        <span className="sp" style={{ ['--c' as string]: 'var(--ink-2)' }}><Icon name="users" /></span>
        <span className="grow"><b>{members}</b> {members === 1 ? 'member' : 'members'} took part{board ? ' · ranked on a leaderboard' : ''}</span>
      </div>

      <div className="kv">
        <div className="wide"><div className="k">Goal</div><div className="v">{goalText(c)}</div></div>
        {h ? <div className="wide"><div className="k">A day counted when</div><div className="v">{habitGoalText(h, c.daily_target ?? h.goal ?? 0)}</div></div> : null}
        <div><div className="k">Dates</div><div className="v">{fmtWindow(c)}</div></div>
        <div><div className="k">Type</div><div className="v">{look.kind}</div></div>
      </div>
    </>
  );
}
