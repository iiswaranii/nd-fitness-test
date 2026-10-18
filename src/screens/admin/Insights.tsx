import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Screen';
import { PullToRefresh, RefreshButton } from '../../components/PullToRefresh';
import { Button, ErrorText } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { HBars, StatusBar, VBars } from '../../components/Charts';
import { useToast } from '../../components/Toast';
import { useStore } from '../../lib/store';
import { data } from '../../lib/data';
import { diffDays, fmtDay, today } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { saveCsv, saveXlsx } from '../../lib/exporter';
import { goalText, status } from '../../lib/progress';
import type { MemberStat } from '../../lib/types';
import { AGE_BANDS, audienceText } from '../../lib/audience';

type Act = 'Active' | 'Quiet' | 'Inactive';
/** Active: did something in the last 7 days. Quiet: 8–30 days ago. Inactive: over 30 days, or never. */
function activity(m: MemberStat): Act {
  if (!m.last_active) return 'Inactive';
  const d = diffDays(m.last_active, today());
  return d <= 7 ? 'Active' : d <= 30 ? 'Quiet' : 'Inactive';
}
const ACT_COLOR: Record<Act, string> = { Active: 'var(--good)', Quiet: 'var(--warn)', Inactive: 'var(--bad)' };

function groupCount(xs: MemberStat[], key: (m: MemberStat) => string, top = 10) {
  const by = new Map<string, number>();
  xs.forEach((m) => by.set(key(m), (by.get(key(m)) ?? 0) + 1));
  const sorted = [...by.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, top).map(([label, value]) => ({ label, value }));
  const rest = sorted.slice(top).reduce((s, [, v]) => s + v, 0);
  return rest ? [...head, { label: `Other (${sorted.length - top})`, value: rest }] : head;
}

export default function Insights() {
  const nav = useNavigate();
  const toast = useToast();
  const { challenges, reload } = useStore();
  const [all, setAll] = useState<MemberStat[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [country, setCountry] = useState('All');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Act | 'All' | 'Not taking part'>('All');

  const refresh = useCallback(async () => {
    try { const [s] = await Promise.all([data.memberStats(), reload()]); setAll(s); setErr(null); } catch (e) { setErr(friendlyError(e)); }
  }, [reload]);
  useEffect(() => { refresh(); }, [refresh]);

  const countries = useMemo(() => ['All', ...groupCount(all ?? [], (m) => m.country ?? 'Unknown', 99).map((r) => r.label)], [all]);
  const ms = useMemo(() => (all ?? []).filter((m) => country === 'All' || (m.country ?? 'Unknown') === country), [all, country]);

  if (err) return <Screen back onBack={() => nav('/admin')}><ErrorText>{err}</ErrorText></Screen>;
  if (!all) return <Screen back onBack={() => nav('/admin')}><p className="muted">Loading insights…</p></Screen>;

  const acts = ms.map((m) => ({ m, a: activity(m) }));
  const n = (a: Act) => acts.filter((x) => x.a === a).length;
  const taking = ms.filter((m) => m.live_challenges > 0).length;
  const strava = ms.filter((m) => m.strava_connected).length;
  const byState = groupCount(ms, (m) => (country === 'All' && m.country !== 'India' ? `${m.state ?? 'Unknown'}, ${m.country}` : m.state ?? 'Unknown'));
  const byCountry = groupCount(all, (m) => m.country ?? 'Unknown', 8);

  // New members per month, last 6 months
  const months: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), value: ms.filter((m) => m.joined_at.startsWith(key)).length });
  }

  const live = challenges.filter((c) => status(c) === 'active' || status(c) === 'upcoming');
  const list = acts
    .filter(({ m, a }) => (filter === 'All' || (filter === 'Not taking part' ? m.live_challenges === 0 : a === filter)))
    .filter(({ m }) => !q || `${m.name} ${m.city ?? ''} ${m.state ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => (y.m.last_active ?? '').localeCompare(x.m.last_active ?? ''));

  const memberRows = (): (string | number | null)[][] => [
    ['Name', 'City', 'State', 'Country', 'Age group', 'Joined app', 'Strava', 'Challenges joined', 'Live challenges', 'Last active', 'Status'],
    ...acts.map(({ m, a }) => [m.name, m.city, m.state, m.country, m.age_band || 'Not given', m.joined_at.slice(0, 10), m.strava_connected ? 'Linked' : 'No link yet', m.challenges, m.live_challenges, m.last_active ?? 'Never', a]),
  ];
  const summaryRows = (): (string | number | null)[][] => [
    ['Metric', 'Value'], ['Report date', today()], ['Country filter', country], ['Members', ms.length], ['Taking part in a live challenge', taking],
    ['Not taking part', ms.length - taking], ['Active (last 7 days)', n('Active')], ['Quiet (8–30 days)', n('Quiet')], ['Inactive (30+ days or never)', n('Inactive')], ['Added Strava activities', strava],
  ];
  const fname = (ext: string) => `member-insights${country === 'All' ? '' : '-' + country.toLowerCase().replace(/\s+/g, '-')}-${today()}.${ext}`;
  const run = async (f: () => Promise<void>, ok: string) => {
    try { await f(); toast(ok); } catch (e) { toast((e as { code?: string })?.code === 'declined' ? 'Download cancelled' : friendlyError(e)); }
  };

  return (
    <Screen back onBack={() => nav('/admin')} right={<RefreshButton onRefresh={refresh} label="Refresh insights" />}>
      <PullToRefresh onRefresh={refresh}>
      <div className="stack loose">
        <div className="stack tight">
          <p className="eyebrow">Admin</p>
          <h1 className="h1">Member insights</h1>
          <p className="small muted">Who’s taking part, who’s active, and where members live. Height and weight are private and never included.</p>
        </div>

        <div className="chip-row">
          {countries.map((c) => <button key={c} className="chip" aria-pressed={country === c} onClick={() => setCountry(c)}>{c}</button>)}
        </div>

        <div className="kpis">
          <div className="card"><div className="k">Members</div><div className="v">{ms.length}</div><div className="s">{strava} added Strava activities</div></div>
          <div className="card"><div className="k">Taking part</div><div className="v">{taking}</div><div className="s">{Math.round((taking / Math.max(1, ms.length)) * 100)}% in a live challenge</div></div>
          <div className="card"><div className="k">Active this week</div><div className="v">{n('Active')}</div><div className="s">logged or added in 7 days</div></div>
          <div className="card"><div className="k">Need a nudge</div><div className="v">{ms.length - taking}</div><div className="s">not in any live challenge</div></div>
        </div>

        <section className="card stack">
          <h2 className="h2">How active are members?</h2>
          <StatusBar parts={[
            { label: 'Active', value: n('Active'), color: ACT_COLOR.Active, hint: 'last 7 days' },
            { label: 'Quiet', value: n('Quiet'), color: ACT_COLOR.Quiet, hint: '8–30 days ago' },
            { label: 'Inactive', value: n('Inactive'), color: ACT_COLOR.Inactive, hint: '30+ days or never' },
          ]} />
        </section>

        <section className="card stack">
          <div className="sec-h"><h2 className="h2">Members by state</h2><span className="small muted">{country === 'All' ? 'All countries' : country}</span></div>
          <HBars rows={byState} label="Members by state" />
        </section>

        <section className="card stack">
          <div className="sec-h"><h2 className="h2">Age groups</h2><span className="small muted">from members’ birthdays</span></div>
          <HBars rows={[...AGE_BANDS, 'Not given'].map((b) => ({ label: b, value: ms.filter((m) => (m.age_band || 'Not given') === b).length }))} color="var(--good)" label="Members by age group" />
        </section>

        {country === 'All' ? (
          <section className="card stack">
            <h2 className="h2">Members by country</h2>
            <HBars rows={byCountry} color="var(--walk)" label="Members by country" />
          </section>
        ) : null}

        <section className="card stack">
          <div className="sec-h"><h2 className="h2">New members</h2><span className="small muted">last 6 months</span></div>
          <VBars rows={months} label="New members per month" />
        </section>

        <section className="sec">
          <h2 className="h2">Live challenges</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Challenge</th><th>Members</th><th>Ends</th></tr></thead>
              <tbody>
                {live.map((c) => (
                  <tr key={c.id} onClick={() => nav(`/admin/c/${c.id}`)} style={{ cursor: 'pointer' }}>
                    <td><span className="strong">{c.title}</span><br /><span className="small muted">{goalText(c)}</span></td>
                    <td className="n">{c.member_count}</td>
                    <td>{fmtDay(c.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sec">
          <div className="sec-h"><h2 className="h2">Members</h2><span className="small muted">{list.length} shown</span></div>
          <input className="input" type="search" placeholder="Search name, city or state" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
          <div className="chip-row">
            {(['All', 'Active', 'Quiet', 'Inactive', 'Not taking part'] as const).map((f) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
          <div className="list">
            {list.slice(0, 60).map(({ m, a }) => (
              <div key={m.user_id} className="list-row">
                <div className="grow">
                  <p className="strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</p>
                  <p className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[m.city, m.state, m.country !== 'India' ? m.country : null].filter(Boolean).join(', ')} · {m.live_challenges} live {m.live_challenges === 1 ? 'challenge' : 'challenges'}</p>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <span className="pill" style={{ background: `color-mix(in srgb, ${ACT_COLOR[a]} 15%, transparent)`, color: ACT_COLOR[a] }}>{a}</span>
                  <p className="small muted" style={{ marginTop: 3 }}>{m.last_active ? fmtDay(m.last_active) : 'Never'}</p>
                </div>
              </div>
            ))}
          </div>
          {list.length > 60 ? <p className="legal">Showing 60 of {list.length}. Download the file for everyone.</p> : null}
        </section>

        <section className="card stack tight">
          <h2 className="h2">Download</h2>
          <p className="small muted">Summary, every member, members by state and challenges{country === 'All' ? '' : ` (${country} only)`}.</p>
          <div className="grid2">
            <Button onClick={() => run(() => saveXlsx(fname('xlsx'), [
              { name: 'Summary', rows: summaryRows() },
              { name: 'Members', rows: memberRows() },
              { name: 'By state', rows: [['State', 'Members'], ...groupCount(ms, (m) => `${m.state ?? 'Unknown'}${m.country && m.country !== 'India' ? ', ' + m.country : ''}`, 999).map((r) => [r.label, r.value])] },
              { name: 'Age groups', rows: [['Age group', 'Members'], ...[...AGE_BANDS, 'Not given'].map((b) => [b, ms.filter((m) => (m.age_band || 'Not given') === b).length])] },
              { name: 'Challenges', rows: [['Challenge', 'Type', 'Goal', 'Open to', 'Start', 'End', 'Members', 'Status'], ...challenges.map((c) => [c.title, c.category === 'activity' ? 'Physical exercise' : 'Healthy habit', goalText(c), audienceText(c), c.start_date, c.end_date, c.member_count, status(c)])] },
            ]), 'Excel file ready')}><Icon name="download" />Excel</Button>
            <Button variant="secondary" onClick={() => run(() => saveCsv(fname('csv'), memberRows()), 'CSV ready')}><Icon name="download" />CSV</Button>
          </div>
        </section>
      </div>
      </PullToRefresh>
    </Screen>
  );
}
