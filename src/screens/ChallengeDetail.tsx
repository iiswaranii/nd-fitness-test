import { useCallback, useEffect, useState } from 'react';
import { Community } from '../components/Community';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { PullToRefresh, RefreshButton } from '../components/PullToRefresh';
import { Button, ErrorText } from '../components/Form';
import { Icon } from '../components/Icon';
import { Rings } from '../components/Ring';
import { StatusPill } from '../components/ChallengeCard';
import { JoinSheet } from '../components/JoinSheet';
import { EDIT_DAYS, HabitLogger } from '../components/HabitLogger';
import { Picker } from '../components/Picker';
import { REMINDER_TIMES, enablePush, pushState } from '../lib/push';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { lookOf } from '../lib/look';
import { audienceText, hasAudience } from '../lib/audience';
import { canJoin, challengeDays, dayText, fmtValue, goalText, progress, regOpen, status, unitOf } from '../lib/progress';
import { addDays, fmtDay, fmtKm, fmtDur, fmtRange, longDay, parse, relDay, today } from '../lib/dates';
import { dayMet, habitByKey, habitGoalText } from '../lib/habits';
import { friendlyError } from '../lib/errors';

const KM_TARGETS = [0, 2, 3, 5, 8];

export default function ChallengeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { challenges, activities, logs, reload, loading, markSeen, isAdmin } = useStore();
  const c = challenges.find((x) => x.id === id);
  useEffect(() => { if (c) markSeen(c.id); }, [c, markSeen]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(async () => { await reload(); setTick((t) => t + 1); }, [reload]);
  const [join, setJoin] = useState(false);
  const [log, setLog] = useState(false);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!c) {
    return (
      <Screen back>
        <div className="card empty"><Icon name="trophy" /><p className="strong">{loading ? 'Loading…' : 'Challenge not found'}</p></div>
      </Screen>
    );
  }

  const look = lookOf(c);
  const st = status(c);
  const h = habitByKey(c.habit_key);
  const p = c.joined && st !== 'upcoming' ? progress(c, activities, logs) : null;
  const target = c.daily_target ?? h?.goal ?? 0;

  return (
    <Screen back right={<RefreshButton onRefresh={refresh} />}>
      <PullToRefresh onRefresh={refresh}>
      <div className="stack loose" style={{ ['--c' as string]: look.color }}>
        <div className="stack tight">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="sp lg"><Icon name={look.icon} /></span>
            <StatusPill c={c} done={p?.done} />
          </div>
          <p className="eyebrow">{look.kind}</p>
          <h1 className="h1">{c.title}</h1>
          {hasAudience(c) ? <span className="aud-tag" style={{ alignSelf: 'flex-start' }}><Icon name="users" />Specially for {audienceText(c)}</span> : null}
          {c.description ? <p className="lead">{c.description}</p> : null}
        </div>

        {p ? (
          <div className="card hero">
            <Rings rings={[{ pct: p.pct, color: look.color }]} size={124} label={`${Math.round(p.pct)}% complete`}>
              <b style={{ fontSize: 24 }}>{Math.floor(p.pct)}%</b><span>complete</span>
            </Rings>
            <div className="legend">
              <div><div className="lg-t">Completed</div><div className="lg-v">{fmtValue(c, p.value)}<small>/ {c.target} {unitOf(c)}</small></div></div>
              <div>
                <div className="lg-t">{p.done ? 'Result' : 'Remaining'}</div>
                <div className="lg-v" style={{ fontSize: 18 }}>{p.done ? 'Goal complete' : <>{fmtValue(c, p.remaining)}<small>{unitOf(c)}</small></>}</div>
                {st === 'active' && !p.done ? (
                  <div className="lg-s">{dayText(c)} · <span style={{ color: p.onTrack ? 'var(--good)' : 'var(--warn)', fontWeight: 700 }}>{p.onTrack ? 'On track' : 'Time to catch up'}</span></div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {c.joined && c.category === 'habit' && h && st === 'active' ? (
          <Button className="tint" onClick={() => setLog(true)}><Icon name="plus" />Log or edit a day</Button>
        ) : null}

        {p && c.category === 'habit' && h ? (
          <section className="sec">
            <div className="sec-h"><h2 className="h2">Your days</h2><span className="small muted">{p.metDays.length} counted</span></div>
            <div className="days">
              {[...challengeDays(c, 21)].reverse().map((d) => {
                const l = logs.find((x) => x.challenge_id === c.id && x.date === d);
                const met = dayMet(h, target, l?.value);
                const cls = met ? 'met' : l ? 'miss' : '';
                return (
                  <button key={d} className={`day ${cls} ${d === today() ? 'today' : ''}`} title={`${longDay(d)}: ${l ? (met ? 'counted' : 'logged, goal not met') : 'not logged'}`}
                    aria-label={`${longDay(d)}: ${l ? (met ? 'counted' : 'goal not met') : 'not logged'}`}
                    onClick={() => (d >= addDays(today(), -(EDIT_DAYS - 1)) && st === 'active' ? setLog(true) : undefined)}>
                    {parse(d).getDate()}
                  </button>
                );
              })}
            </div>
            <p className="small muted">{`Filled = goal met · Tinted = logged but missed · Grey = not logged. Tap a recent day to log or correct it (last ${EDIT_DAYS} days).`}</p>
          </section>
        ) : null}

        {c.joined && c.category === 'activity' && st === 'active' ? (
          <section className="card stack tight">
            <p><span className="strong">Your daily target</span> <span className="small muted">· optional</span></p>
            <p className="small muted">{c.my_daily_target ? `A green ring on Today tracks ${c.my_daily_target} km a day.` : 'Add one to get a daily green ring on Today.'}</p>
            <div className="chip-row wrap">
              {KM_TARGETS.map((k) => (
                <button key={k} className="chip" aria-pressed={(c.my_daily_target ?? 0) === k}
                  onClick={async () => { try { await data.setMyDailyTarget(c.id, k || null); await reload(); toast(k ? `Daily target set to ${k} km` : 'Daily target removed'); } catch (e) { toast(friendlyError(e)); } }}>
                  {k ? `${k} km` : 'No target'}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {c.joined && (st === 'active' || st === 'upcoming') ? (
          <section className="card row" style={{ gap: 12 }}>
            <span className="sp" style={{ ['--c' as string]: 'var(--ride)' }}><Icon name="bell" /></span>
            <span className="grow" style={{ minWidth: 0 }}><span className="strong" style={{ display: 'block' }}>Daily reminder</span><span className="small muted">Only on days you haven’t logged</span></span>
            <div style={{ width: 132, flex: 'none' }}>
              <Picker compact title="Remind me at" value={c.my_reminder ?? ''} options={REMINDER_TIMES} search={false}
                onChange={async (v) => {
                  try {
                    if (v && (await pushState()) === 'off') await enablePush();
                    await data.setReminder(c.id, v || null); await reload();
                    toast(v ? `Reminder set for ${REMINDER_TIMES.find((x) => x.value === v)?.label}` : 'Reminder off');
                  } catch (e) { toast(friendlyError(e)); }
                }} />
            </div>
          </section>
        ) : null}

        {(c.joined || isAdmin) && st !== 'upcoming' && st !== 'cancelled' ? <Community c={c} refreshKey={tick} /> : null}

        <div className="kv">
          <div className="wide"><div className="k">Goal</div><div className="v">{goalText(c)}</div></div>
          {h ? <div className="wide"><div className="k">A day counts when</div><div className="v">{habitGoalText(h, target)}</div></div> : null}
          <div><div className="k">Dates</div><div className="v">{fmtRange(c.start_date, c.end_date)}</div></div>
          <div><div className="k">Members</div><div className="v">{c.member_count}</div></div>
          <div><div className="k">Registration opens</div><div className="v">{regOpen(c) ? 'Open now' : fmtDay(c.reg_opens)}</div></div>
          <div><div className="k">Last date to join</div><div className="v">{fmtDay(c.join_by)}</div></div>
          <div className="wide">
            <div className="k">How progress is counted</div>
            <div className="v" style={{ fontWeight: 600, fontSize: 14 }}>
              {c.category === 'activity'
                ? `${c.sport === 'walk' ? 'Walks and hikes' : c.sport === 'run' ? 'Runs' : 'Rides'} added from Strava links, dated between ${fmtDay(c.start_date)} and ${fmtDay(c.end_date)}${c.metric === 'count' ? `, each at least ${c.min_km} km` : ''}. Other sports don’t count.`
                : 'You log it yourself in the app each day. Days before you joined or after the end date don’t count.'}
            </div>
          </div>
        </div>

        {p && c.category === 'activity' && p.counted.length ? (
          <section className="sec">
            <div className="sec-h"><h2 className="h2">Counted activities</h2><span className="small muted">{p.counted.length} · {fmtKm(p.km)} km</span></div>
            <div className="list">
              {p.counted.slice(0, 8).map((a) => (
                <div key={a.id} className="list-row">
                  <span className="sp"><Icon name={a.sport} /></span>
                  <span className="grow"><span className="strong" style={{ display: 'block' }}>{a.name}</span><span className="small muted">{relDay(a.date)} · {fmtDur(a.moving_s)}</span></span>
                  <span className="rv">{fmtKm(a.km)}<small>km</small></span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {st === 'active' || st === 'upcoming' ? (
          c.joined ? (
            <Button variant="ghost" onClick={() => setLeave(true)}>Leave challenge</Button>
          ) : canJoin(c) ? (
            <Button className="tint" onClick={() => setJoin(true)}><Icon name="plus" />Join challenge</Button>
          ) : !regOpen(c) ? (
            <div className="card row" style={{ gap: 12, ['--c' as string]: 'var(--warn)' }}>
              <span className="sp"><Icon name="cal" /></span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="strong" style={{ display: 'block' }}>Registration opens {longDay(c.reg_opens)}</span>
                <span className="small muted">You can join from that day until {fmtDay(c.join_by)}. The challenge starts {fmtDay(c.start_date)}.</span>
              </span>
            </div>
          ) : <p className="legal">Enrolment for this challenge is closed.</p>
        ) : null}
      </div>
      </PullToRefresh>

      <JoinSheet c={join ? c : null} onClose={() => setJoin(false)} />
      <HabitLogger c={c} open={log} onClose={() => setLog(false)} />
      <Sheet open={leave} onClose={() => setLeave(false)} label="Leave challenge">
        <h2 className="h1" style={{ fontSize: 24 }}>Leave this challenge?</h2>
        <p className="lead">{c.category === 'habit' ? 'Your logged days for this challenge will be removed.' : 'Your activities stay in the app, but they’ll stop counting here.'}</p>
        <ErrorText>{err}</ErrorText>
        <div className="stack tight">
          <Button variant="danger" loading={busy} onClick={async () => {
            setBusy(true); setErr(null);
            try { await data.leave(c.id); await reload(); setLeave(false); toast(`You left ${c.title}`); nav('/challenges', { replace: true }); }
            catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
          }}>Leave</Button>
          <Button variant="ghost" onClick={() => setLeave(false)}>Stay</Button>
        </div>
      </Sheet>
    </Screen>
  );
}

