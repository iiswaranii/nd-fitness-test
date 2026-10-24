import { resultsOf } from '../lib/results';
import { fmtMoment } from '../lib/dates';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { Bar } from './Ring';
import { data } from '../lib/data';
import { useSession } from '../lib/session';
import { hasBoard, nudge, rankBoard, together, weekOverWeek, type BoardRow } from '../lib/board';
import { fmtAmount, habitByKey } from '../lib/habits';
import { lookOf } from '../lib/look';
import { status } from '../lib/progress';
import type { Challenge, Participant } from '../lib/types';
import { Flag } from './Flag';
import { Trophy, type Tier } from './Trophy';

/** "India", "India and Canada", "India, Canada and the UK" */
const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * The community part of a challenge.
 * - Leaderboard challenges: everyone's total, a friendly nudge, and "you vs last week".
 * - Others: a "we're in this together" card — no ranking, just encouragement.
 */
export function Community({ c, refreshKey = 0 }: { c: Challenge; refreshKey?: number }) {
  const { user } = useSession();
  const [ps, setPs] = useState<Participant[] | null>(null);
  const [err, setErr] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    data.board(c.id).then((r) => alive && setPs(r)).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [c.id, c.member_count, refreshKey]);

  if (err) return null;
  if (!ps) return <div className="card" aria-busy="true"><p className="small muted">Loading the community…</p></div>;

  const rows = rankBoard(c, ps, user?.id ?? null);
  const look = lookOf(c);
  const me = ps.find((p) => p.user_id === user?.id);
  const wow = weekOverWeek(c, me);
  const h = habitByKey(c.habit_key);
  const unit = c.category === 'activity' ? 'km' : h?.unit ?? '';
  const fmt = (v: number) => (c.category === 'activity' ? `${v.toFixed(2)} km` : fmtAmount(Math.round(v), unit));
  const finished = status(c) === 'finished';

  if (!hasBoard(c)) {
    const g = together(c, rows);
    const names = [...rows].sort((x, y) => Number(y.me) - Number(x.me) || x.name.localeCompare(y.name));
    return (
      <section className="card stack" style={{ ['--c' as string]: look.color }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="sp"><Icon name="heart" /></span>
          <div style={{ minWidth: 0 }}>
            <h2 className="h2">{me ? 'You’re already a winner' : 'How the group is doing'}</h2>
            <p className="small muted">{me ? 'Taking part is what counts. Every day you show up is a win.' : 'Taking part is what counts here. Every day members show up is a win.'}</p>
          </div>
        </div>
        <div className="stat3">
          <div><div className="k">In this together</div><div className="v">{g.members}</div></div>
          <div><div className="k">Logged today</div><div className="v">{g.loggedToday}</div></div>
          <div><div className="k">Group wins</div><div className="v">{g.groupDays}</div></div>
        </div>
        <p className="small" style={{ color: 'var(--ink-2)' }}>
          {!me ? `${g.loggedToday} ${g.loggedToday === 1 ? 'member has' : 'members have'} logged today.` : g.loggedToday >= 2 ? `${g.loggedToday} members have already logged today. Join them!` : 'Be one of the first to log today and set the tone for everyone.'}
        </p>
        {names.length ? (
          <div className="stack tight">
            <p className="grp-h" style={{ margin: 0 }}>Who’s taking part</p>
            {/* Names only, A–Z (you first): no numbers or totals, so nobody reads it as a ranking. */}
            <div className="list">
              {names.filter((_, i) => all || i < 8).map((r) => (
                <div key={r.user_id} className={`board-row ${r.me ? 'me' : ''}`}>
                  <Avatar name={r.name} size={36} />
                  <span className="strong nm grow" style={{ minWidth: 0 }}>{r.name}<Flag country={r.country} />{r.me ? <span className="you">You</span> : null}</span>
                </div>
              ))}
            </div>
            {names.length > 8 ? <button className="link-btn" onClick={() => setAll((a) => !a)}>{all ? 'Show less' : `Show all ${names.length}`}</button> : null}
          </div>
        ) : null}
      </section>
    );
  }

  // Results are final only when the last member's final day is over (members can live in different time zones).
  const res = resultsOf(c, ps);
  const final = finished && res.final;
  const waiting = finished && !res.final;
  const resultsTime = fmtMoment(new Date(res.at).toISOString());
  const myIndex = rows.findIndex((r) => r.me);
  // Podium for the top three who have actually scored; the list continues from 4th.
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const podium = ranked.filter((r) => r.rank <= 3 && r.value > 0);
  const rest = podium.length ? ranked.filter((r) => r.rank > podium.length) : ranked;
  const shown: (BoardRow & { rank: number })[] = rest.filter((r, i) => all || i < 8 || r.me);
  const top = Math.max(1, rows[0]?.value ?? 1);

  return (
    <section className="sec" style={{ ['--c' as string]: look.color }}>
      <div className="sec-h"><h2 className="h2">{waiting ? 'Standings so far' : 'Leaderboard'}</h2><span className="small muted">{rows.length} {rows.length === 1 ? 'member' : 'members'}</span></div>
      {waiting ? (
        <div className="results-wait" role="status">
          <span className="rw-ic"><Icon name="clock" /></span>
          <div style={{ minWidth: 0 }}>
            <p className="strong">Final results at {resultsTime}</p>
            <p className="small muted">
              {res.stillGoing.length ? `Members in ${listOf(res.stillGoing)} are still on their last day.` : 'Some members are still on their last day in their time zone.'} Everyone gets the same full days, so we wait for them.
            </p>
          </div>
        </div>
      ) : !finished && res.spread ? (
        <p className="small muted results-note"><Icon name="users" className="ic" />Members are in different time zones. Final results: {resultsTime}.</p>
      ) : null}
      {myIndex >= 0 && !finished ? (
        <div className="nudge">
          <Icon name="sparkle" />
          <p>{nudge(c, rows)}</p>
        </div>
      ) : null}
      {wow && !finished ? (
        <div className="card row" style={{ gap: 12, padding: 14 }}>
          <span className="sp"><Icon name="pulse" /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <p className="strong">You vs last week</p>
            <p className="small muted">
              {wow.now > wow.prev ? `Up from ${fmt(wow.prev)}. You’re improving!` : wow.now === wow.prev && wow.now === 0 ? 'A fresh week. Start strong!' : `${fmt(wow.prev)} last week. A little more and you’ll beat it.`}
            </p>
          </div>
          <span className="rv">{fmt(wow.now)}</span>
        </div>
      ) : null}
      {podium.length ? <Podium rows={podium} finished={final} /> : null}
      {shown.length ? <div className="list">
        {shown.map((r) => (
          <div key={r.user_id} className={`board-row ${r.me ? 'me' : ''}`}>
            <span className="rk">{r.rank}</span>
            <Avatar name={r.name} size={36} />
            <div className="grow" style={{ minWidth: 0 }}>
              <span className="strong nm">{r.name}<Flag country={r.country} />{r.me ? <span className="you">You</span> : null}</span>
              <Bar pct={(r.value / top) * 100} color={look.color} small />
            </div>
            <span className="rv">{r.label}</span>
          </div>
        ))}
      </div> : null}
      {rest.length > 8 ? <button className="link-btn" onClick={() => setAll((a) => !a)}>{all ? 'Show less' : `Show all ${rows.length}`}</button> : null}
      <p className="legal">Everyone here is moving forward. Cheer each other on!</p>
    </section>
  );
}

/** Top three on steps: 2nd · 1st · 3rd, each with a trophy. */
function Podium({ rows, finished }: { rows: (BoardRow & { rank: number })[]; finished: boolean }) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as (BoardRow & { rank: number })[];
  const tier = (r: number): Tier => (r === 1 ? 'gold' : r === 2 ? 'silver' : 'bronze');
  return (
    <div className="podium" aria-label={finished ? 'Final podium' : 'Current top three'}>
      {order.map((r) => (
        <div key={r.user_id} className={`pod p${r.rank} ${r.me ? 'me' : ''}`}>
          <Trophy tier={tier(r.rank)} size={r.rank === 1 ? 52 : 42} />
          <Avatar name={r.name} size={r.rank === 1 ? 46 : 38} />
          <span className="pn">{r.name.split(' ')[0]}<Flag country={r.country} /></span>
          <span className="pv">{r.label}</span>
          {r.me ? <span className="you" style={{ marginLeft: 0 }}>You</span> : null}
          <div className="step"><b>{r.rank}</b></div>
        </div>
      ))}
    </div>
  );
}
