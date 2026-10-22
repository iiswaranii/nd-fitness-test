import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Page';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Form';
import { Icon } from '../components/Icon';
import { Rings } from '../components/Ring';
import { PullToRefresh, RefreshButton } from '../components/PullToRefresh';
import { AddLinkSheet } from '../components/AddLinkSheet';
import { HabitLogger } from '../components/HabitLogger';
import { useSession } from '../lib/session';
import { data } from '../lib/data';
import { useStore } from '../lib/store';
import { canJoin, dayOf, dayText, fmtValue, progress, status, totalDays, unitOf } from '../lib/progress';
import { dayMet, fmtAmount, fmtClock, habitByKey } from '../lib/habits';
import { lookOf } from '../lib/look';
import { longDay, relDay, today } from '../lib/dates';
import type { Challenge } from '../lib/types';

export default function Today() {
  const nav = useNavigate();
  const { user, profile } = useSession();
  const { challenges, activities, logs, loading, error, reload, isAdmin } = useStore();
  const name = profile?.full_name || user?.name || 'there';
  const [addFor, setAddFor] = useState<Challenge | null>(null);
  const [logFor, setLogFor] = useState<Challenge | null>(null);
  const [noDob, setNoDob] = useState(false);
  useEffect(() => { data.getHealth().then((h) => setNoDob(!h?.dob)).catch(() => {}); }, []);

  const active = challenges.filter((c) => c.joined && status(c) === 'active');
  // Habits with something to do today first in the carousel? Keep: activity first, then habits.
  const heroes = [...active].sort((a, b) => (a.category === b.category ? 0 : a.category === 'activity' ? -1 : 1));
  const habits = active.filter((c) => c.category === 'habit');
  const openN = challenges.filter(canJoin).length;
  const exercise = active.filter((c) => c.category === 'activity');

  const refresh = useCallback(async () => { await reload(); }, [reload]);

  return (
    <Page>
      <PullToRefresh onRefresh={refresh}>
        <div className="stack loose">
          <div className="page-head">
            <div>
              <p className="eyebrow">{longDay(today())}</p>
              <h1 className="h1" style={{ marginTop: 2 }}>Hello, {name.split(' ')[0]}</h1>
            </div>
            <div className="head-actions">
              <RefreshButton onRefresh={refresh} />
              <button className="icon-btn" style={{ padding: 0, overflow: 'hidden' }} onClick={() => nav('/profile')} aria-label="Your profile">
                <Avatar name={name} size={44} />
              </button>
            </div>
          </div>

          {error ? <p className="notice">{error}</p> : null}

          {noDob ? (
            <button className="card row" style={{ gap: 12, textAlign: 'left', width: '100%' }} onClick={() => nav('/profile')}>
              <span className="sp" style={{ ['--c' as string]: 'var(--run)' }}><Icon name="cal" /></span>
              <span className="grow" style={{ minWidth: 0 }}><span className="strong" style={{ display: 'block' }}>Add your birthday</span><span className="small muted">Some challenges are for certain age groups. It stays private.</span></span>
              <Icon name="chev" />
            </button>
          ) : null}

          {heroes.length ? (
            <ProgressCarousel items={heroes} onOpenHabit={setLogFor} />
          ) : !loading ? (
            <div className="card empty">
              <Icon name="trophy" />
              {isAdmin && !challenges.length ? (
                <>
                  <p className="strong">Create the first challenge</p>
                  <p className="small muted">Nothing here yet. Members will see it as soon as you publish it.</p>
                  <Button style={{ width: 'auto' }} onClick={() => nav('/admin/new')}>Create a challenge</Button>
                </>
              ) : (
                <>
                  <p className="strong">No active challenge yet</p>
                  <p className="small muted">{challenges.length ? 'Join a challenge to see your progress rings here.' : 'New challenges will show up here. We’ll let you know.'}</p>
                  {challenges.length ? <Button style={{ width: 'auto' }} onClick={() => nav('/challenges?tab=open')}>Find a challenge</Button> : null}
                </>
              )}
            </div>
          ) : null}

          {exercise.length || habits.length ? (
            <section className="sec">
              <div className="sec-h"><h2 className="h2">Today’s log</h2><span className="small muted">Tap to log</span></div>
              <div className="list">
                {exercise.map((c) => <ExerciseRow key={c.id} c={c} onOpen={() => setAddFor(c)} />)}
                {habits.map((c) => (
                  <HabitRow key={c.id} c={c} onOpen={() => setLogFor(c)} logValue={logs.find((l) => l.challenge_id === c.id && l.date === today())} />
                ))}
              </div>
            </section>
          ) : null}

          {openN ? (
            <button className="card row" style={{ gap: 12, textAlign: 'left', width: '100%' }} onClick={() => nav('/challenges?tab=open')}>
              <span className="sp" style={{ ['--c' as string]: 'var(--ride)' }}><Icon name="trophy" /></span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="strong" style={{ display: 'block' }}>{openN} {openN === 1 ? 'challenge is' : 'challenges are'} open to join</span>
                <span className="small muted">Walking, cycling and healthy habits</span>
              </span>
              <Icon name="chev" />
            </button>
          ) : null}

          {activities.length ? (
            <section className="sec">
              <div className="sec-h"><h2 className="h2">Latest from Strava</h2><button className="link-btn" onClick={() => nav('/activity')}>See all</button></div>
              <div className="list">
                {activities.slice(0, 2).map((a) => (
                  <div key={a.id} className="list-row">
                    <span className="sp" style={{ ['--c' as string]: `var(--${a.sport})` }}><Icon name={a.sport} /></span>
                    <span className="grow"><span className="strong" style={{ display: 'block' }}>{a.name}</span><span className="small muted">{relDay(a.date)}{a.time !== '00:00' ? ` · ${a.time}` : ''}</span></span>
                    <span className="rv">{a.km.toFixed(2)}<small>km</small></span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </PullToRefresh>

      <HabitLogger c={logFor} open={!!logFor} onClose={() => setLogFor(null)} />
      <AddLinkSheet open={!!addFor} forChallenge={addFor} onClose={() => setAddFor(null)} />
    </Page>
  );
}

/** A walking / running / cycling challenge in today's log. Tapping opens "Add from Strava". */
function ExerciseRow({ c, onOpen }: { c: Challenge; onOpen: () => void }) {
  const { activities } = useStore();
  const look = lookOf(c);
  const km = activities.filter((a) => a.sport === c.sport && a.date === today()).reduce((s, a) => s + a.km, 0);
  const n = activities.filter((a) => a.sport === c.sport && a.date === today()).length;
  const goal = c.my_daily_target;
  const met = goal ? km >= goal - 1e-9 : n > 0;
  const verb = c.sport === 'run' ? 'run' : c.sport === 'ride' ? 'ride' : 'walk';
  const status = n === 0
    ? `No ${verb} added yet · tap to add from Strava`
    : `${km.toFixed(2)} km today${goal ? ` of ${goal} km` : ''} · tap to add another`;
  return (
    <button className="hrow" style={{ ['--c' as string]: look.color, width: '100%', textAlign: 'left' }} onClick={onOpen} aria-label={`${c.title}: ${status}`}>
      <span className="sp"><Icon name={look.icon} /></span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="t" style={{ display: 'block' }}>{c.title}</span>
        <span className="s" style={{ color: met ? 'var(--good)' : undefined, fontWeight: met ? 700 : undefined }}>{met ? '✓ ' : ''}{status}</span>
      </span>
      {met ? <span className="check-ring" aria-hidden="true" data-on="true"><Icon name="check" /></span> : <Icon name="plus" />}
    </button>
  );
}

function HabitRow({ c, logValue, onOpen }: {
  c: Challenge;
  logValue?: { value: number; entries: number[] };
  onOpen: () => void;
}) {
  const h = habitByKey(c.habit_key);
  const look = lookOf(c);
  if (!h) return null;
  const target = c.daily_target ?? h.goal ?? 0;
  const v = logValue?.value ?? null;
  const met = dayMet(h, target, v);
  const status = v === null ? 'Not logged yet · tap to log'
    : h.kind === 'amount' ? `${fmtAmount(v, h.unit)} of ${fmtAmount(target, h.unit)}${h.dir === 'atMost' ? ' limit' : ''}`
    : h.kind === 'time' ? `${fmtClock(v)} · goal ${fmtClock(target)}`
    : v ? 'Done' : 'Not today';

  // One tap target: opening the habit is the only way to log, so nothing is logged by accident.
  return (
    <button className="hrow" style={{ ['--c' as string]: look.color, width: '100%', textAlign: 'left' }} onClick={onOpen} aria-label={`${h.name}: ${status}`}>
      <span className="sp"><Icon name={look.icon} /></span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="t" style={{ display: 'block' }}>{h.name}</span>
        <span className="s" style={{ color: met ? 'var(--good)' : undefined, fontWeight: met ? 700 : undefined }}>{met ? '✓ ' : ''}{status}</span>
      </span>
      {met ? <span className="check-ring" aria-hidden="true" data-on="true"><Icon name="check" /></span> : <Icon name="chev" />}
    </button>
  );
}

function ProgressCarousel({ items, onOpenHabit }: { items: Challenge[]; onOpenHabit: (c: Challenge) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const many = items.length > 1;
  useEffect(() => {
    const el = ref.current;
    if (!el || !many) return;
    const on = () => {
      const w = (el.firstElementChild as HTMLElement).getBoundingClientRect().width + 10;
      setI(Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / w))));
    };
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, [many, items.length]);
  const go = (d: number) => {
    const el = ref.current; if (!el) return;
    const w = (el.firstElementChild as HTMLElement).getBoundingClientRect().width + 10;
    el.scrollTo({ left: (i + d) * w, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return (
    <section className="sec">
      <div className="sec-h">
        <h2 className="h2">Your progress</h2>
        {many ? (
          <div className="navs">
            <span className="small muted" style={{ fontWeight: 600 }}>{i + 1} of {items.length}</span>
            <button className="navb" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous challenge"><Icon name="back" /></button>
            <button className="navb" onClick={() => go(1)} disabled={i === items.length - 1} aria-label="Next challenge"><Icon name="chev" /></button>
          </div>
        ) : null}
      </div>
      <div className={`car ${many ? '' : 'one'}`} ref={ref}>
        {items.map((c) => <HeroCard key={c.id} c={c} onOpenHabit={onOpenHabit} />)}
      </div>
      {many ? <div className="dots" aria-hidden="true">{items.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div> : null}
    </section>
  );
}

function HeroCard({ c, onOpenHabit }: { c: Challenge; onOpenHabit: (c: Challenge) => void }) {
  const nav = useNavigate();
  const { activities, logs } = useStore();
  const p = progress(c, activities, logs);
  const look = lookOf(c);
  const h = habitByKey(c.habit_key);

  // Habits: the big coloured ring is TODAY (fills as you log), the inner green ring is days completed.
  if (c.category === 'habit' && h) {
    const target = c.daily_target ?? h.goal ?? 0;
    const tv = p.todayValue;
    const todayPct = h.kind === 'amount' && h.dir !== 'atMost' && h.key !== 'weigh-in' && target
      ? Math.min(100, ((tv ?? 0) / target) * 100)
      : p.todayMet ? 100 : 0;
    const centre = h.kind === 'amount' && h.dir !== 'atMost' && h.key !== 'weigh-in' ? `${Math.floor(todayPct)}%` : p.todayMet ? '✓' : tv === null ? '—' : '✕';
    const todayText = tv === null ? 'Not logged yet' : h.kind === 'amount' ? fmtAmount(tv, h.unit) : h.kind === 'time' ? fmtClock(tv) : tv ? 'Done' : 'Not today';
    return (
      <button className="card hero" onClick={() => onOpenHabit(c)} aria-label={`${c.title}: today ${todayText}, ${dayText(c)}, ${p.value} of ${c.target} days done`}>
        <Rings rings={[{ pct: todayPct, color: look.color }, { pct: p.pct, color: 'var(--today)' }]} size={136} label={`Today ${Math.round(todayPct)}%`}>
          <b>{centre}</b><span>today</span>
        </Rings>
        <div className="legend">
          <div>
            <div className="lg-t"><span className="dotc" style={{ background: look.color }} /><span>Today · {h.name}</span></div>
            <div className="lg-v" style={{ fontSize: 20 }}>{tv === null ? '0' : h.kind === 'amount' ? fmtAmount(tv) : h.kind === 'time' ? fmtClock(tv) : tv ? 'Done' : '—'}
              {h.kind === 'amount' && h.key !== 'weigh-in' ? <small>/ {fmtAmount(target, h.unit)}</small> : null}</div>
            <div className="lg-s">{p.todayMet ? 'Counted for today' : h.kind === 'amount' && h.dir !== 'atMost' && h.key !== 'weigh-in' ? `${fmtAmount(Math.max(0, target - (tv ?? 0)), h.unit)} to go` : 'Tap to log'}</div>
          </div>
          <div>
            <div className="lg-t"><span className="dotc" style={{ background: 'var(--today)' }} /><span>{c.title}</span></div>
            <div className="lg-v" style={{ fontSize: 18 }}>Day {dayOf(c)}<small>/ {totalDays(c)}</small></div>
            <div className="lg-s">{p.done ? 'Challenge complete' : `${p.value} of ${c.target} days done`}</div>
          </div>
        </div>
      </button>
    );
  }

  const rings = [{ pct: p.pct, color: look.color }];
  if (c.my_daily_target) rings.push({ pct: Math.min(100, ((p.todayValue ?? 0) / c.my_daily_target) * 100), color: 'var(--today)' });
  return (
    <button className="card hero" onClick={() => nav(`/c/${c.id}`)} aria-label={`${c.title}, ${Math.floor(p.pct)} percent`}>
      <Rings rings={rings} size={136} label={`${Math.round(p.pct)}% of ${c.title}`}>
        <b>{Math.floor(p.pct)}%</b><span>{fmtValue(c, p.value)} of {c.target} {unitOf(c)}</span>
      </Rings>
      <div className="legend">
        <div>
          <div className="lg-t"><span className="dotc" style={{ background: look.color }} /><span>{c.title}</span></div>
          <div className="lg-v">{fmtValue(c, p.value)}<small>/ {c.target} {unitOf(c)}</small></div>
          <div className="lg-s">{p.done ? 'Goal complete' : dayText(c)}</div>
        </div>
        {c.my_daily_target ? (
          <div>
            <div className="lg-t"><span className="dotc" style={{ background: 'var(--today)' }} /><span>Today’s target</span></div>
            <div className="lg-v" style={{ fontSize: 18 }}>{(p.todayValue ?? 0).toFixed(2)}<small>/ {c.my_daily_target} km</small></div>
            <div className="lg-s">{p.todayMet ? 'Done for today' : `${Math.max(0, c.my_daily_target - (p.todayValue ?? 0)).toFixed(2)} km to go`}</div>
          </div>
        ) : null}
      </div>
    </button>
  );
}
