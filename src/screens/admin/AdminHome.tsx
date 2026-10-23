import { TEST_INBOX } from '../../lib/config';
import { useNavigate } from 'react-router-dom';
import { Page } from '../../components/Page';
import { Icon } from '../../components/Icon';
import { StatusPill } from '../../components/ChallengeCard';
import { PullToRefresh, RefreshButton } from '../../components/PullToRefresh';
import { useStore } from '../../lib/store';
import { lookOf } from '../../lib/look';
import { goalText, status } from '../../lib/progress';
import { fmtRange } from '../../lib/dates';
import { audienceText, hasAudience } from '../../lib/audience';

export default function AdminHome() {
  const nav = useNavigate();
  const { allChallenges: challenges, reload } = useStore();
  const order = ['active', 'upcoming', 'finished', 'cancelled'] as const;
  const live = challenges.filter((c) => status(c) === 'active').length;
  const members = challenges.filter((c) => status(c) === 'active').reduce((s, c) => s + c.member_count, 0);

  return (
    <Page>
      <PullToRefresh onRefresh={reload}>
        <div className="stack loose">
          <div className="page-head">
            <div><p className="eyebrow">Admin</p><h1 className="h1">Challenges</h1></div>
            <div className="head-actions">
              <RefreshButton onRefresh={reload} />
              <button className="newbtn" onClick={() => nav('/admin/new')}><Icon name="plus" />New</button>
            </div>
          </div>
          <button className="card row" style={{ gap: 12, textAlign: 'left', width: '100%' }} onClick={() => nav('/admin/insights')}>
            <span className="sp" style={{ ['--c' as string]: 'var(--ride)' }}><Icon name="users" /></span>
            <span className="grow" style={{ minWidth: 0 }}><span className="strong" style={{ display: 'block' }}>Member insights</span><span className="small muted">Participation, active members, states and countries · Excel & CSV</span></span>
            <Icon name="chev" />
          </button>
          {TEST_INBOX ? (
            <button className="card row" style={{ gap: 12, textAlign: 'left', width: '100%' }} onClick={() => nav('/admin/inbox')}>
              <span className="sp" style={{ ['--c' as string]: 'var(--warn)' }}><Icon name="mail" /></span>
              <span className="grow" style={{ minWidth: 0 }}><span className="strong" style={{ display: 'block' }}>Test inbox</span><span className="small muted">Login codes for testers · test setup only</span></span>
              <Icon name="chev" />
            </button>
          ) : null}
          <div className="stat3">
            <div><div className="k">Live</div><div className="v">{live}</div></div>
            <div><div className="k">Enrolments</div><div className="v">{members}</div></div>
            <div><div className="k">Total</div><div className="v">{challenges.length}</div></div>
          </div>
          {order.map((st) => {
            const xs = challenges.filter((c) => status(c) === st);
            if (!xs.length) return null;
            return (
              <section key={st} className="sec">
                <h2 className="h2">{st[0].toUpperCase() + st.slice(1)}</h2>
                <div className="list">
                  {xs.map((c) => {
                    const look = lookOf(c);
                    return (
                      <button key={c.id} className="list-row" style={{ ['--c' as string]: look.color }} onClick={() => nav(`/admin/c/${c.id}`)}>
                        <span className="sp"><Icon name={look.icon} /></span>
                        <span className="grow">
                          <span className="strong" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                          <span className="small muted" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtRange(c.start_date, c.end_date)} · {c.member_count} joined · {goalText(c)}</span>
                          {hasAudience(c) ? <span className="aud-tag" style={{ marginTop: 4 }}><Icon name="users" />{audienceText(c)}</span> : null}
                        </span>
                        <StatusPill c={c} />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!challenges.length ? (
            <div className="card empty"><Icon name="trophy" /><p className="strong">No challenges yet</p><p className="small muted">Create the first one for your members.</p></div>
          ) : null}
        </div>
      </PullToRefresh>
    </Page>
  );
}
