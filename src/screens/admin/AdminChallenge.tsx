import { joinByText, regOpensText, fmtWindow } from '../../lib/dates';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Screen';
import { PullToRefresh, RefreshButton } from '../../components/PullToRefresh';
import { Button, ErrorText } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { StatusPill } from '../../components/ChallengeCard';
import { useToast } from '../../components/Toast';
import { useStore } from '../../lib/store';
import { data } from '../../lib/data';
import { lookOf } from '../../lib/look';
import { fmtValue, goalText, progress, status, unitOf } from '../../lib/progress';
import { today } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { habitByKey, habitGoalText } from '../../lib/habits';
import { saveCsv, saveXlsx } from '../../lib/exporter';
import { audienceText, hasAudience } from '../../lib/audience';
import type { Challenge, Participant } from '../../lib/types';
import { Flag } from '../../components/Flag';

type Row = { p: Participant; value: number; pct: number; done: boolean; onTrack: boolean; counted: number; km: number };

function rowsFor(c: Challenge, ps: Participant[]): Row[] {
  return ps.map((p) => {
    const pr = progress({ ...c, joined: true }, p.activities, p.logs);
    return { p, value: pr.value, pct: pr.pct, done: pr.done, onTrack: pr.onTrack, counted: c.category === 'activity' ? pr.counted.length : pr.metDays.length, km: pr.km };
  }).sort((a, b) => b.value - a.value);
}

function exportRows(c: Challenge, rows: Row[]): (string | number | null)[][] {
  const h = habitByKey(c.habit_key);
  const st = status(c);
  return [
    ['Challenge', 'Type', 'Goal', 'Daily rule', 'Start', 'End', 'Member', 'City', 'Strava', 'Progress', 'Target', 'Unit', 'Percent', 'Status', c.category === 'activity' ? 'Activities counted' : 'Days counted', 'Distance counted (km)'],
    ...rows.map((r) => [
      c.title, c.category === 'activity' ? 'Physical exercise' : 'Healthy habit', goalText(c), h ? habitGoalText(h, c.daily_target ?? h.goal ?? 0) : '',
      c.start_date, c.end_date, r.p.name, r.p.city ?? '', c.category === 'activity' ? (r.p.strava_connected ? 'Linked' : 'No link yet') : '',
      fmtValue(c, r.value), c.target, unitOf(c), Math.floor(r.pct),
      r.done ? 'Completed' : st === 'finished' ? 'Not completed' : st === 'upcoming' ? 'Not started' : r.onTrack ? 'On track' : 'Behind',
      r.counted, c.category === 'activity' ? +r.km.toFixed(2) : '',
    ]),
  ];
}
const slug = (c: Challenge) => `${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today()}`;

export default function AdminChallenge() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { allChallenges: challenges, reload } = useStore();
  const c = challenges.find((x) => x.id === id);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!c) return;
    try { setRows(rowsFor(c, await data.participants(c.id))); setErr(null); } catch (e) { setErr(friendlyError(e)); }
  }, [c]);
  useEffect(() => { load(); }, [load]);
  const refresh = useCallback(async () => { await reload(); await load(); }, [reload, load]);

  if (!c) return <Screen back><p className="muted">Challenge not found.</p></Screen>;
  const look = lookOf(c);
  const st = status(c);
  const avg = rows?.length ? rows.reduce((s, r) => s + r.pct, 0) / rows.length : 0;

  return (
    <Screen back onBack={() => nav('/admin')} right={<RefreshButton onRefresh={refresh} label="Refresh participants" />}>
      <PullToRefresh onRefresh={refresh}>
      <div className="stack loose" style={{ ['--c' as string]: look.color }}>
        <div className="stack tight">
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="sp lg"><Icon name={look.icon} /></span><StatusPill c={c} /></div>
          <p className="eyebrow">{look.kind}</p>
          <h1 className="h1">{c.title}</h1>
          {hasAudience(c) ? <span className="aud-tag" style={{ alignSelf: 'flex-start' }}><Icon name="users" />Only for: {audienceText(c)}</span> : null}
          <p className="small muted">{goalText(c)} · {fmtWindow(c)} · registration {regOpensText(c)} – {joinByText(c)}</p>
        </div>

        <div className="stat3">
          <div><div className="k">Members</div><div className="v">{c.member_count}</div></div>
          <div><div className="k">Avg progress</div><div className="v">{Math.round(avg)}%</div></div>
          <div><div className="k">Completed</div><div className="v">{rows?.filter((r) => r.done).length ?? '–'}</div></div>
        </div>

        <section className="sec">
          <div className="sec-h"><h2 className="h2">Participants</h2></div>
          <ErrorText>{err}</ErrorText>
          {rows === null && !err ? <p className="muted">Loading…</p> : rows && rows.length ? (
            <div className="tbl">
              <table>
                <thead><tr><th>#</th><th>Member</th><th>Progress</th><th>%</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.p.user_id}>
                      <td className="n">{i + 1}</td>
                      <td><span className="strong">{r.p.name}</span><Flag country={r.p.country} />{r.p.city ? <span className="muted"> · {r.p.city}</span> : null}</td>
                      <td className="n">{fmtValue(c, r.value)} / {c.target} {unitOf(c)}</td>
                      <td className="n">{Math.floor(r.pct)}%</td>
                      <td>
                        {c.category === 'activity' && !r.p.strava_connected ? <span className="pill warn">No Strava link yet</span>
                          : st === 'upcoming' ? <span className="pill">Not started</span>
                          : r.done ? <span className="pill good">Completed</span>
                          : r.onTrack ? <span className="pill good">On track</span> : <span className="pill warn">Behind</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="small muted">No one has joined yet.</p>}
        </section>

        <div className="grid2">
          <Button disabled={!rows?.length} onClick={() => rows && saveXlsx(`${slug(c)}.xlsx`, [{ name: 'Participants', rows: exportRows(c, rows) }]).then(() => toast('Excel file ready')).catch((e) => toast((e as { code?: string })?.code === 'declined' ? 'Download cancelled' : friendlyError(e)))}><Icon name="download" />Excel</Button>
          <Button variant="secondary" disabled={!rows?.length} onClick={() => rows && saveCsv(`${slug(c)}.csv`, exportRows(c, rows)).then(() => toast('CSV ready')).catch((e) => toast((e as { code?: string })?.code === 'declined' ? 'Download cancelled' : friendlyError(e)))}><Icon name="download" />CSV</Button>
        </div>

        {st === 'active' || st === 'upcoming' ? (
          <Button variant="danger" onClick={() => setCancel(true)}>Cancel challenge</Button>
        ) : null}
      </div>
      </PullToRefresh>

      <Sheet open={cancel} onClose={() => setCancel(false)} label="Cancel challenge">
        <h2 className="h1" style={{ fontSize: 24 }}>Cancel this challenge?</h2>
        <p className="lead">Members will see it as cancelled and progress stops counting. This can’t be undone.</p>
        <div className="stack tight">
          <Button variant="danger" loading={busy} onClick={async () => {
            setBusy(true);
            try { await data.cancelChallenge(c.id); await reload(); setCancel(false); toast('Challenge cancelled'); }
            catch (e) { toast(friendlyError(e)); } finally { setBusy(false); }
          }}>Cancel challenge</Button>
          <Button variant="ghost" onClick={() => setCancel(false)}>Keep it</Button>
        </div>
      </Sheet>
    </Screen>
  );
}
