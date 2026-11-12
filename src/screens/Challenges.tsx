import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import { ChallengeCard, OpenCard } from '../components/ChallengeCard';
import { JoinSheet } from '../components/JoinSheet';
import { PullToRefresh, RefreshButton } from '../components/PullToRefresh';
import { useStore } from '../lib/store';
import { canJoin, joinStillOpen, progress, regOpen, status } from '../lib/progress';
import type { Challenge } from '../lib/types';

type Tab = 'joined' | 'open' | 'finished';
type Kind = 'all' | 'activity' | 'habit';

/** Finished challenges grouped by the month they ended, newest first: [["November 2026", [...]], ...] */
function byMonth(xs: Challenge[]): [string, Challenge[]][] {
  const out = new Map<string, Challenge[]>();
  for (const c of xs) {
    const [y, m] = c.end_date.split('-').map(Number);
    const key = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    out.set(key, [...(out.get(key) ?? []), c]);
  }
  return [...out.entries()];
}

export default function Challenges() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<Kind>('all');
  const [joinC, setJoinC] = useState<Challenge | null>(null);
  const { challenges, allActivities: activities, logs, reload, loading, newIds } = useStore();

  const byKind = (c: Challenge) => kind === 'all' || c.category === kind;
  const live = (c: Challenge) => status(c) === 'active' || status(c) === 'upcoming';
  // Registration over but the challenge is still running: shown under "Enrolment closed" until it ends.
  const closed = (c: Challenge) => regOpen(c) && !joinStillOpen(c);
  const notJoined = challenges.filter((c) => !c.joined && live(c));
  const groups: Record<Tab, Challenge[]> = {
    joined: challenges.filter((c) => c.joined && live(c)),
    open: notJoined.filter((c) => !closed(c)).sort((a, b) => Number(canJoin(b)) - Number(canJoin(a)) || a.start_date.localeCompare(b.start_date)),
    // Only the challenges this member took part in.
    finished: challenges.filter((c) => c.joined && !live(c)).sort((a, b) => b.end_date.localeCompare(a.end_date)),
  };
  const closedList = notJoined.filter(closed).sort((a, b) => a.end_date.localeCompare(b.end_date));
  // No tab chosen: your live challenges if you have any, otherwise what you can join.
  const tab: Tab = (params.get('tab') as Tab) || (groups.joined.length || !(groups.open.length || closedList.length) ? 'joined' : 'open');
  const list = groups[tab].filter(byKind);
  const closedShown = tab === 'open' ? closedList.filter(byKind) : [];
  const finishedJoined = groups.finished;
  const completed = finishedJoined.filter((c) => progress(c, activities, logs).done).length;

  return (
    <Page>
      <PullToRefresh onRefresh={reload}>
        <div className="stack">
          <div className="page-head"><div><p className="eyebrow">Community</p><h1 className="h1">Challenges</h1></div><RefreshButton onRefresh={reload} /></div>
          <div className="seg" role="tablist">
            {([['joined', 'Joined'], ['open', 'Open to join'], ['finished', 'Finished']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k }, { replace: true })}>
                {l} <span className="muted" style={{ fontSize: 12 }}>{groups[k].length}</span>
                {k === 'open' && groups.open.some((c) => newIds.has(c.id)) ? <span className="new-badge">New</span> : null}
              </button>
            ))}
          </div>
          <div className="chip-row">
            {([['all', 'All'], ['activity', 'Physical exercise'], ['habit', 'Healthy habits']] as const).map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
            ))}
          </div>
          {tab === 'finished' && finishedJoined.length ? (
            <p className="small muted">You completed {completed} of the {finishedJoined.length} finished {finishedJoined.length === 1 ? 'challenge' : 'challenges'} you joined.</p>
          ) : null}
          {loading && !challenges.length ? <p className="muted center-text">Loading…</p> : list.length ? (
            tab === 'finished' ? byMonth(list).map(([m, xs]) => (
              <section key={m} className="stack tight" aria-label={m}>
                <h2 className="month-h">{m}</h2>
                <div className="cc-grid">{xs.map((c) => <ChallengeCard key={c.id} c={c} />)}</div>
              </section>
            )) : <div className="cc-grid">{list.map((c) => (tab === 'open' ? <OpenCard key={c.id} c={c} onJoin={setJoinC} /> : <ChallengeCard key={c.id} c={c} />))}</div>
          ) : tab === 'joined' ? (
            <EmptyState icon="trophy" title="You’re not in a challenge yet"
              text={groups.open.length ? `${groups.open.length} ${groups.open.length === 1 ? 'challenge is' : 'challenges are'} open right now. Pick one and start today.` : 'When a new challenge opens, it shows up under Open to join. We’ll let you know.'}>
              {groups.open.length ? <button className="btn" style={{ width: 'auto' }} onClick={() => setParams({ tab: 'open' })}><Icon name="plus" />Find a challenge</button> : null}
            </EmptyState>
          ) : tab === 'open' ? (
            closedShown.length ? null : (
              <EmptyState icon="sparkle" title="New challenges are coming soon"
                text="Your admins are planning the next one. As soon as it opens, it appears here and we’ll send you a notification." />
            )
          ) : (
            <EmptyState icon="podium" title="Your finished challenges will live here"
              text="Finish a challenge and your result, your place and any trophy you win show up here." >
              {groups.joined.length ? <button className="btn ghost" style={{ width: 'auto' }} onClick={() => setParams({ tab: 'joined' })}>See your live challenges</button> : null}
            </EmptyState>
          )}
          {closedShown.length ? (
            <section className="stack tight closed-sec" aria-label="Enrolment closed">
              <div className="closed-h"><Icon name="clock" className="ic" /><h2 className="h2">Enrolment closed</h2><span className="small muted">{closedShown.length}</span></div>
              <p className="small muted" style={{ marginTop: -4 }}>These are already under way. You can still follow along. Keep an eye out for the next one!</p>
              <div className="cc-grid">{closedShown.map((c) => <OpenCard key={c.id} c={c} onJoin={setJoinC} />)}</div>
            </section>
          ) : null}
        </div>
      </PullToRefresh>
      <JoinSheet c={joinC} onClose={() => setJoinC(null)} onJoined={(c) => nav(`/c/${c.id}`)} />
    </Page>
  );
}
