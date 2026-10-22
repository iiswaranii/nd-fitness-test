import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Page';
import { Button } from '../components/Form';
import { Icon } from '../components/Icon';
import { PullToRefresh, RefreshButton } from '../components/PullToRefresh';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { data } from '../lib/data';
import { friendlyError } from '../lib/errors';
import { AddLinkSheet } from '../components/AddLinkSheet';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { addDays, fmtDay, fmtDur, fmtHms, fmtKm, relDay, today } from '../lib/dates';
import { SPORTS, type Activity as Act } from '../lib/types';

const weekStart = (s: string) => { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };

export default function Activity() {
  const { activities, reload } = useStore();
  const { profile } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [link, setLink] = useState(false);
  const [del, setDel] = useState<Act | null>(null);
  const [busy, setBusy] = useState(false);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const refresh = useCallback(async () => { await reload(); }, [reload]);

  const cut = addDays(today(), -13);
  const recent = activities.filter((a) => a.date >= cut);
  const older = activities.filter((a) => a.date < cut);
  const byDay: Record<string, Act[]> = {};
  recent.forEach((a) => (byDay[a.date] ??= []).push(a));
  const byWeek: Record<string, Act[]> = {};
  older.forEach((a) => (byWeek[weekStart(a.date)] ??= []).push(a));
  const week = activities.filter((a) => a.date >= weekStart(today()));

  return (
    <Page>
      <PullToRefresh onRefresh={refresh}>
        <div className="stack">
          <div className="page-head"><div><p className="eyebrow">From Strava</p><h1 className="h1">Activity</h1></div><RefreshButton onRefresh={refresh} /></div>

          <Button variant="strava" onClick={() => setLink(true)}><Icon name="link" />Add a Strava activity</Button>
          {profile?.strava_connected && profile.strava_athlete_name ? <p className="small muted" style={{ marginTop: -4, textAlign: 'center' }}>Linked to {profile.strava_athlete_name} on Strava</p> : null}
          {activities.length ? (
            <>

              <div className="stat3">
                <div><div className="k">This week</div><div className="v">{fmtKm(week.reduce((s, a) => s + a.km, 0))}<small className="muted" style={{ fontSize: 12, marginLeft: 2 }}>km</small></div></div>
                <div><div className="k">Active time</div><div className="v">{fmtDur(week.reduce((s, a) => s + a.moving_s, 0))}</div></div>
                <div><div className="k">Activities</div><div className="v">{week.length}</div></div>
              </div>


              {Object.keys(byDay).sort().reverse().map((d) => (
                <div key={d} className="stack tight">
                  <p className="grp-h">{relDay(d)}</p>
                  <div className="list">
                    {byDay[d].map((a) => <ActRow key={a.id} a={a} onOpen={() => setDel(a)} />)}
                  </div>
                </div>
              ))}

              {older.length ? (
                <div className="stack tight">
                  <p className="grp-h">Earlier · weekly summary</p>
                  <div className="list">
                    {Object.keys(byWeek).sort().reverse().map((w) => {
                      const xs = byWeek[w];
                      const open = openWeek === w;
                      return (
                        <div key={w}>
                          <button className="list-row" aria-expanded={open} onClick={() => setOpenWeek(open ? null : w)}>
                            <span className="sp" style={{ ['--c' as string]: 'var(--ink-2)' }}><Icon name="cal" /></span>
                            <span className="grow"><span className="strong" style={{ display: 'block' }}>Week of {fmtDay(w)}</span><span className="small muted">{xs.length} {xs.length === 1 ? 'activity' : 'activities'} · {fmtDur(xs.reduce((s, a) => s + a.moving_s, 0))}</span></span>
                            <span className="rv">{fmtKm(xs.reduce((s, a) => s + a.km, 0))}<small>km</small></span>
                          </button>
                          {open ? xs.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).map((a) => <ActRow key={a.id} a={a} onOpen={() => setDel(a)} showDate />) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <p className="legal">Strava shares distance and time, not step counts. For a steps goal, join a “Daily steps” habit challenge.</p>
            </>
          ) : (
            <div className="card stack tight">
              <p className="strong">How to add a walk, run or ride</p>
              <ol className="steps">
                <li><span className="n">1</span><span>Record it in the Strava app as usual.</span></li>
                <li><span className="n">2</span><span>Open the activity and tap <span className="strong">Share → Copy link</span>.</span></li>
                <li><span className="n">3</span><span>Come back, tap <span className="strong">Add a Strava activity</span> and paste.</span></li>
              </ol>
              <p className="small muted">It then counts toward every challenge you’ve joined for that sport and date.</p>
            </div>
          )}
          <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => nav('/challenges')}>Go to challenges</button>
        </div>
      </PullToRefresh>
      <AddLinkSheet open={link} onClose={() => setLink(false)} />
      <Sheet open={!!del} onClose={() => setDel(null)} label="Activity">
        {del ? (
          <>
            <div className="stack tight">
              <h2 className="h1" style={{ fontSize: 24 }}>{del.name}</h2>
              <p className="lead">{SPORTS[del.sport].verb} · {fmtDay(del.date)} · {fmtKm(del.km)} km · {fmtHms(del.moving_s)}</p>
              {del.source === 'manual' ? <p className="small muted">Distance and time typed in from Strava.</p> : null}
            </div>
            <div className="stack tight">
              <a className="btn ghost" href={del.url ?? `https://www.strava.com/activities/${del.id}`} target="_blank" rel="noreferrer">Open in Strava</a>
              <Button variant="danger" loading={busy} onClick={async () => {
                setBusy(true);
                try { await data.removeActivity(del.id); await reload(); setDel(null); toast('Activity deleted'); }
                catch (e) { toast(friendlyError(e)); } finally { setBusy(false); }
              }}><Icon name="trash" />Delete this activity</Button>
              <p className="legal">Deleting removes it from your list and from live challenges. Challenges that have already finished keep it, so their results don’t change. Nothing changes on Strava, and you can add it back with its link.</p>
            </div>
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}

function ActRow({ a, onOpen, showDate }: { a: Act; onOpen: () => void; showDate?: boolean }) {
  return (
    <div className="list-row act-row" style={{ ['--c' as string]: SPORTS[a.sport].color }}>
      <button className="act-main" onClick={onOpen} aria-label={`${a.name}, details`}>
        <span className="sp"><Icon name={SPORTS[a.sport].icon} /></span>
        <span className="grow">
          <span className="strong" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
          <span className="small muted">{showDate ? `${fmtDay(a.date)} · ` : ''}{SPORTS[a.sport].verb}{a.time !== '00:00' && !showDate ? ` · ${a.time}` : ''} · {fmtHms(a.moving_s)}</span>
        </span>
        <span className="rv">{fmtKm(a.km)}<small>km</small></span>
      </button>
      <button className="icon-btn act-del" onClick={onOpen} aria-label={`Delete ${a.name}`}><Icon name="trash" /></button>
    </div>
  );
}
