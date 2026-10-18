import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { Icon } from '../components/Icon';
import { ChallengeCard, OpenCard } from '../components/ChallengeCard';
import { JoinSheet } from '../components/JoinSheet';
import { PullToRefresh, RefreshButton } from '../components/PullToRefresh';
import { useStore } from '../lib/store';
import { canJoin, progress, status } from '../lib/progress';
import type { Challenge } from '../lib/types';

type Tab = 'joined' | 'open' | 'finished';
type Kind = 'all' | 'activity' | 'habit';

export default function Challenges() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'joined';
  const [kind, setKind] = useState<Kind>('all');
  const [joinC, setJoinC] = useState<Challenge | null>(null);
  const { challenges, activities, logs, reload, loading } = useStore();

  const byKind = (c: Challenge) => kind === 'all' || c.category === kind;
  const live = (c: Challenge) => status(c) === 'active' || status(c) === 'upcoming';
  const groups: Record<Tab, Challenge[]> = {
    joined: challenges.filter((c) => c.joined && live(c)),
    open: challenges.filter((c) => !c.joined && live(c)).sort((a, b) => Number(canJoin(b)) - Number(canJoin(a)) || a.start_date.localeCompare(b.start_date)),
    finished: challenges.filter((c) => !live(c)).sort((a, b) => b.end_date.localeCompare(a.end_date)),
  };
  const list = groups[tab].filter(byKind);
  const empty = {
    joined: ['You haven’t joined a challenge yet', 'Open to join shows the ones you can join now.'],
    open: ['Nothing new to join', 'New challenges from your admin will appear here.'],
    finished: ['No finished challenges yet', 'Your past challenges and results will appear here.'],
  }[tab];
  const finishedJoined = groups.finished.filter((c) => c.joined);
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
            list.map((c) => (tab === 'open' ? <OpenCard key={c.id} c={c} onJoin={setJoinC} /> : <ChallengeCard key={c.id} c={c} />))
          ) : (
            <div className="card empty">
              <Icon name="trophy" />
              <p className="strong">{empty[0]}</p>
              <p className="small muted">{empty[1]}</p>
              {tab === 'joined' && groups.open.length ? <button className="link-btn" onClick={() => setParams({ tab: 'open' })}>See open challenges</button> : null}
            </div>
          )}
        </div>
      </PullToRefresh>
      <JoinSheet c={joinC} onClose={() => setJoinC(null)} onJoined={(c) => nav(`/c/${c.id}`)} />
    </Page>
  );
}
