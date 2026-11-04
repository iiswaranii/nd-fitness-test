import { useMemo, useState } from 'react';
import { Screen } from '../components/Screen';
import { Rings } from '../components/Ring';
import { Icon } from '../components/Icon';
import { useStore } from '../lib/store';
import { fmtDur, fmtKm, parse, today } from '../lib/dates';
import { change, currentStreak, rangeOf, statsFor, usualKm, type Period } from '../lib/stats';
import { SPORTS, type Sport } from '../lib/types';

const RING = { km: 'var(--brand)', days: 'var(--good)', habits: 'var(--focus)' };

/** Weekly / monthly personal stats, in the spirit of Apple Health and Google Fit: rings, a chart, and how it compares. */
export default function Stats() {
  const { allActivities: acts, logs, challenges } = useStore();
  const [p, setP] = useState<Period>('week');
  const [off, setOff] = useState(0);

  const r = useMemo(() => rangeOf(p, off), [p, off]);
  const s = useMemo(() => statsFor(r, acts, logs, challenges), [r, acts, logs, challenges]);
  // Compare like with like: for the current (unfinished) week/month, only the same number of days of the one before.
  const prevRange = useMemo(() => {
    const pr = rangeOf(p, off - 1);
    if (off !== 0) return pr;
    const n = r.days.filter((d) => d <= today()).length;
    const days = pr.days.slice(0, n);
    return { ...pr, to: days[days.length - 1], days };
  }, [p, off, r]);
  const prev = useMemo(() => statsFor(prevRange, acts, logs, challenges), [prevRange, acts, logs, challenges]);
  const sameDays = off === 0 && prevRange.days.length < rangeOf(p, off - 1).days.length;
  const goal = useMemo(() => usualKm(p, off, acts, challenges, logs), [p, off, acts, challenges, logs]);
  const streak = useMemo(() => currentStreak(acts, logs, challenges), [acts, logs, challenges]);

  const kmPct = Math.min(100, (s.km / goal) * 100);
  const dayPct = s.daysSoFar ? (s.activeDays / s.daysSoFar) * 100 : 0;
  const habitPct = s.habitPossible ? (s.habitMet / s.habitPossible) * 100 : 0;
  const ch = change(s.km, prev.km);
  const unitWord = p === 'week' ? 'week' : 'month';

  // Chart: day by day for a week; week by week for a month.
  const bars = p === 'week'
    ? r.days.map((d) => ({ label: parse(d).toLocaleDateString('en-GB', { weekday: 'narrow' }), value: s.perDay[d] ?? 0, today: d === today(), future: d > today() }))
    : Array.from({ length: Math.ceil(r.days.length / 7) }, (_, w) => {
      const ds = r.days.slice(w * 7, w * 7 + 7);
      return { label: `${parse(ds[0]).getDate()}–${parse(ds[ds.length - 1]).getDate()}`, value: ds.reduce((t, d) => t + (s.perDay[d] ?? 0), 0), today: ds.includes(today()), future: ds[0] > today() };
    });
  const maxBar = Math.max(0.1, ...bars.map((b) => b.value));
  const sports = (Object.keys(SPORTS) as Sport[]).filter((k) => s.bySport[k].n > 0);

  return (
    <Screen back>
      <div className="stack loose">
        <div className="stack tight">
          <p className="eyebrow">Your stats</p>
          <h1 className="h1">{r.label}</h1>
        </div>

        <div className="seg" role="tablist" aria-label="Week or month">
          {(['week', 'month'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={p === k} onClick={() => { setP(k); setOff(0); }}>{k === 'week' ? 'Week' : 'Month'}</button>
          ))}
        </div>

        <div className="st-nav">
          <button className="navb" onClick={() => setOff(off - 1)} aria-label={`Previous ${unitWord}`}><Icon name="back" /></button>
          <span className="small muted" style={{ fontWeight: 700 }}>{fmtShort(r.from)} – {fmtShort(r.to)}</span>
          <button className="navb" onClick={() => setOff(off + 1)} disabled={off >= 0} aria-label={`Next ${unitWord}`}><Icon name="chev" /></button>
        </div>

        <section className="card st-rings">
          <Rings size={150} label={`Distance ${Math.round(kmPct)}%, active days ${Math.round(dayPct)}%, habits ${Math.round(habitPct)}%`}
            rings={[{ pct: kmPct, color: RING.km }, { pct: dayPct, color: RING.days }, { pct: habitPct, color: RING.habits }]} />
          <div className="st-legend">
            <div><span className="dotc" style={{ background: RING.km }} /><div><b>{fmtKm(s.km)}<small> / {goal} km</small></b><span>Distance · your usual</span></div></div>
            <div><span className="dotc" style={{ background: RING.days }} /><div><b>{s.activeDays}<small> / {s.daysSoFar} days</small></b><span>Active days</span></div></div>
            <div><span className="dotc" style={{ background: RING.habits }} /><div><b>{s.habitPossible ? `${Math.round(habitPct)}%` : '–'}{s.habitPossible ? <small> · {s.habitMet}/{s.habitPossible}</small> : null}</b><span>Habit goals met</span></div></div>
          </div>
        </section>

        <div className={`st-trend ${ch === null ? '' : ch >= 0 ? 'up' : 'down'}`}>
          <Icon name={ch !== null && ch < 0 ? 'pulse' : 'sparkle'} />
          <p>{trendText(ch, s.km, prev.km, unitWord)}{sameDays ? <span className="small muted" style={{ display: 'block', fontWeight: 600 }}>Compared with the first {prevRange.days.length} {prevRange.days.length === 1 ? 'day' : 'days'} of last {unitWord}.</span> : null}</p>
        </div>

        <section className="card stack">
          <div className="sec-h"><h2 className="h2">Distance</h2><span className="small muted">km {p === 'week' ? 'per day' : 'per week'}</span></div>
          <div className="st-bars" role="table" aria-label={`Distance ${p === 'week' ? 'per day' : 'per week'}`}>
            {bars.map((b, k) => (
              <div key={k} className={`st-bar${b.today ? ' now' : ''}${b.future ? ' future' : ''}`} role="row">
                <span className="v" role="cell">{b.value ? fmtKm(b.value).replace(/\.00$/, '') : ''}</span>
                <span className="t" aria-hidden="true"><i style={{ height: `${b.value ? Math.max(4, (b.value / maxBar) * 100) : 0}%` }} /></span>
                <span className="l" role="cell">{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="kpis">
          <div className="card"><div className="k">Active time</div><div className="v">{fmtDur(s.seconds)}</div><div className="s">{deltaText(s.seconds, prev.seconds, unitWord)}</div></div>
          <div className="card"><div className="k">Activities</div><div className="v">{s.activities}</div><div className="s">{deltaText(s.activities, prev.activities, unitWord)}</div></div>
          <div className="card"><div className="k">Best day</div><div className="v">{s.bestDay ? `${fmtKm(s.bestDay.km)}` : '–'}<small style={{ fontSize: 13 }}>{s.bestDay ? ' km' : ''}</small></div><div className="s">{s.bestDay ? parse(s.bestDay.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'No activity yet'}</div></div>
          <div className="card"><div className="k">Streak</div><div className="v">{streak}<small style={{ fontSize: 13 }}> {streak === 1 ? 'day' : 'days'}</small></div><div className="s">active in a row</div></div>
        </div>

        {sports.length ? (
          <section className="card stack">
            <h2 className="h2">By sport</h2>
            <div className="list" style={{ boxShadow: 'none', border: 0 }}>
              {sports.map((k) => (
                <div key={k} className="list-row" style={{ ['--c' as string]: SPORTS[k].color, padding: '10px 0' }}>
                  <span className="sp"><Icon name={SPORTS[k].icon} /></span>
                  <span className="grow"><span className="strong" style={{ display: 'block' }}>{SPORTS[k].name}</span><span className="small muted">{s.bySport[k].n} {s.bySport[k].n === 1 ? SPORTS[k].verb.toLowerCase() : SPORTS[k].plural} · {fmtDur(s.bySport[k].s)}</span></span>
                  <span className="rv">{fmtKm(s.bySport[k].km)}<small>km</small></span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="legal">Worked out on your phone from your Strava activities and habit logs. “Your usual” is your average of the last 4 {unitWord}s.</p>
      </div>
    </Screen>
  );
}

const fmtShort = (d: string) => parse(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function trendText(ch: number | null, now: number, before: number, unit: string): string {
  if (ch === null) return now > 0 ? `${fmtKm(now)} km this ${unit}. A great start, keep it going!` : `No distance yet this ${unit}. A short walk is a great start.`;
  if (ch >= 10) return `Up ${ch}% on last ${unit} (${fmtKm(before)} km). You’re on a roll!`;
  if (ch > -10) return `About the same as last ${unit} (${fmtKm(before)} km). Nice and steady.`;
  return `${Math.abs(ch)}% less than last ${unit} (${fmtKm(before)} km). A few short walks will bring it back.`;
}

function deltaText(now: number, before: number, unit: string): string {
  const c = change(now, before);
  if (c === null) return now ? `new this ${unit}` : `none last ${unit}`;
  if (c === 0) return `same as last ${unit}`;
  return `${c > 0 ? '↑' : '↓'} ${Math.abs(c)}% vs last ${unit}`;
}
