import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Screen';
import { Button, ErrorText, TextField } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { HabitPicker } from '../../components/HabitPicker';
import { MultiPicker } from '../../components/Picker';
import { COUNTRY_LIST, INDIAN_STATES } from '../../lib/places';
import { audienceText, hasAudience } from '../../lib/audience';
import { useToast } from '../../components/Toast';
import { useStore } from '../../lib/store';
import { data } from '../../lib/data';
import { addDays, diffDays, fmtRange, today } from '../../lib/dates';
import { fmtAmount, fmtClock, habitByKey, habitGoalText, type Habit } from '../../lib/habits';
import { friendlyError } from '../../lib/errors';
import { goalText } from '../../lib/progress';
import { lookOf } from '../../lib/look';
import { SPORTS, type Category, type Metric, type NewChallenge, type Sport } from '../../lib/types';

const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (s: string) => { const [a, b] = s.split(':').map(Number); return a * 60 + (b || 0); };

export default function CreateChallenge() {
  const nav = useNavigate();
  const toast = useToast();
  const { reload } = useStore();
  const t = today();

  const [category, setCategory] = useState<Category>('activity');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [sport, setSport] = useState<Sport>('walk');
  const [metric, setMetric] = useState<Metric>('distance');
  const [target, setTarget] = useState('50');
  const [minKm, setMinKm] = useState('3');
  const [habit, setHabit] = useState<Habit | null>(null);
  const [daily, setDaily] = useState('');
  const [start, setStart] = useState(t);
  const [end, setEnd] = useState(addDays(t, 29));
  const [regOpens, setRegOpens] = useState(t);
  const [joinBy, setJoinBy] = useState(addDays(t, 7));
  // Optional audience — hidden until switched on.
  const [limit, setLimit] = useState(false);
  const [ageOn, setAgeOn] = useState(false);
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const days = Math.max(1, diffDays(start, end) + 1);

  const pickHabit = (h: Habit) => {
    setHabit(h);
    setDaily(h.kind === 'time' ? toHHMM(h.goal ?? 0) : h.kind === 'amount' ? String(h.goal ?? '') : '');
    if (!title.trim()) setTitle(h.name);
  };

  const build = (): NewChallenge | string => {
    if (title.trim().length < 3) return 'Give the challenge a title (3 characters or more).';
    if (end < start) return 'The end date must be on or after the start date.';
    if (regOpens > joinBy) return 'Registration must open on or before the last date to join.';
    if (joinBy > end) return 'The last date to join must be on or before the end date.';
    const base = {
      title: title.trim(), description: desc.trim() || null, category,
      start_date: start, end_date: end, reg_opens: regOpens, join_by: joinBy,
      sport: null, metric: null, daily_min: null, min_km: null, habit_key: null, daily_target: null,
      aud_min_age: null, aud_max_age: null, aud_countries: null, aud_states: null,
    } as NewChallenge;
    if (limit) {
      const lo = ageOn && minAge ? parseInt(minAge, 10) : null, hi = ageOn && maxAge ? parseInt(maxAge, 10) : null;
      if (lo !== null && (lo < 5 || lo > 110)) return 'Minimum age should be between 5 and 110.';
      if (hi !== null && (hi < 5 || hi > 110)) return 'Maximum age should be between 5 and 110.';
      if (lo !== null && hi !== null && lo > hi) return 'Minimum age must be lower than maximum age.';
      const st = countries.includes('India') ? states : [];
      if (lo === null && hi === null && !countries.length) return 'Choose an age range or a place, or switch “Only for some members” off.';
      Object.assign(base, { aud_min_age: lo, aud_max_age: hi, aud_countries: countries.length ? countries : null, aud_states: st.length ? st : null });
    }
    if (category === 'activity') {
      const tg = parseFloat(target);
      if (!(tg > 0)) return 'Set a target above zero.';
      if (metric === 'days' && tg > days) return `This challenge has only ${days} days.`;
      const mk = parseFloat(minKm);
      if (metric !== 'distance' && !(mk > 0)) return 'Set the minimum km.';
      return { ...base, sport, metric, target: tg, daily_min: metric === 'days' ? mk : null, min_km: metric === 'count' ? mk : null };
    }
    if (!habit) return 'Choose a habit from the list.';
    let dt: number | null = null;
    if (habit.kind === 'amount' && habit.key !== 'weigh-in') { dt = parseFloat(daily); if (!(dt >= 0)) return 'Set the daily target.'; }
    if (habit.kind === 'time') { if (!daily) return 'Set the target time.'; dt = fromHHMM(daily); }
    return { ...base, habit_key: habit.key, daily_target: dt, target: days };
  };

  const preview = useMemo(() => {
    const r = build();
    return typeof r === 'string' ? null : r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, title, desc, sport, metric, target, minKm, habit, daily, start, end, regOpens, joinBy, limit, ageOn, minAge, maxAge, countries, states]);

  return (
    <Screen back>
      <form className="stack loose" onSubmit={async (e) => {
        e.preventDefault();
        const r = build();
        if (typeof r === 'string') { setErr(r); return; }
        setBusy(true); setErr(null);
        try {
          const id = await data.createChallenge(r);
          // Phone notification to members who allow new-challenge alerts. Publishing succeeds even if this fails.
          const sent = await data.announceChallenge(id).then((x) => x.sent).catch(() => 0);
          await reload();
          toast(sent ? `Published · ${sent} members notified` : 'Published · members can see it now');
          nav('/admin', { replace: true });
        }
        catch (e2) { setErr(friendlyError(e2)); }
        finally { setBusy(false); }
      }}>
        <div className="stack tight"><p className="eyebrow">Admin</p><h1 className="h1">New challenge</h1></div>

        <section className="form-sec">
        <div className="form-sec-h"><span className="num">1</span><h2 className="h2">What kind of challenge?</h2></div>
        <div className="field">
          <span className="label sr-only" id="cat-l">Challenge type</span>
          <div className="type-tiles" role="radiogroup" aria-labelledby="cat-l">
            {([
              ['activity', 'Physical exercise', 'Walking, running or cycling. Members add Strava links.', 'walk', 'var(--walk)'],
              ['habit', 'Healthy habit', 'Water, sleep, sugar, yoga and more. Members log daily.', 'leaf', 'var(--good)'],
            ] as const).map(([k, t, d, icon, color]) => (
              <button type="button" key={k} role="radio" aria-checked={category === k} className="type-tile" style={{ ['--c' as string]: color }}
                onClick={() => { setCategory(k); setErr(null); if (k === 'activity') setTarget('50'); }}>
                <span className="sp"><Icon name={icon} /></span>
                <span className="grow"><span className="strong" style={{ display: 'block' }}>{t}</span><span className="small muted">{d}</span></span>
                <span className="radio" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        </section>

        <section className="form-sec">
        <div className="form-sec-h"><span className="num">2</span><h2 className="h2">The goal</h2></div>
        {category === 'activity' ? (
          <>
            <div className="field">
              <span className="label">Sport</span>
              <div className="seg">
                {(Object.keys(SPORTS) as Sport[]).map((k) => <button type="button" key={k} aria-selected={sport === k} onClick={() => setSport(k)}>{SPORTS[k].name}</button>)}
              </div>
            </div>
            <div className="field">
              <span className="label">Goal</span>
              <div className="seg">
                {([['distance', 'Total km'], ['days', 'Active days'], ['count', 'Sessions']] as const).map(([k, l]) => (
                  <button type="button" key={k} aria-selected={metric === k} onClick={() => { setMetric(k); setTarget(k === 'distance' ? '50' : k === 'days' ? '15' : '10'); }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="grid2">
              <TextField label={metric === 'distance' ? 'Total distance (km)' : metric === 'days' ? 'Number of days' : 'Number of sessions'} type="number" inputMode="decimal" min="1" value={target} onChange={(e) => setTarget(e.target.value)} />
              {metric !== 'distance' ? (
                <TextField label={metric === 'days' ? 'Km for a day to count' : 'Min km per session'} type="number" inputMode="decimal" min="0.5" step="0.5" value={minKm} onChange={(e) => setMinKm(e.target.value)} />
              ) : <span />}
            </div>
          </>
        ) : (
          <>
            <HabitPicker value={habit?.key ?? null} onChange={pickHabit} />
            {habit ? (
              <div className="card stack tight">
                <p className="strong">How members log it</p>
                <p className="small muted">
                  {habit.kind === 'amount' ? `They add ${habit.unit} through the day with quick buttons${habit.presets?.length ? ` (${habit.presets.map((p) => '+' + fmtAmount(p)).join(', ')})` : ''}.`
                    : habit.kind === 'time' ? 'They enter the time each day.' : `They answer once a day: “${habit.ask}”`}
                </p>
                {habit.kind === 'amount' && habit.key !== 'weigh-in' ? (
                  <TextField label={`Daily ${habit.dir === 'atMost' ? 'limit' : 'target'} (${habit.unit})`} type="number" inputMode="decimal" min="0" step={habit.step ?? 1} value={daily} onChange={(e) => setDaily(e.target.value)}
                    hint={habit.dir === 'atMost' ? 'Staying at or under this counts.' : 'Reaching this counts the day.'} />
                ) : habit.kind === 'time' ? (
                  <TextField label="Target time" type="time" value={daily} onChange={(e) => setDaily(e.target.value)}
                    hint={daily ? `A day counts when it’s ${fmtClock(fromHHMM(daily))} or earlier.` : undefined} />
                ) : null}
              </div>
            ) : null}
            <p className="hint">A day counts when the member reaches the daily goal. Progress is days completed out of all {days} days of the challenge.</p>
          </>
        )}
        </section>

        <section className="form-sec">
        <div className="form-sec-h"><span className="num">3</span><h2 className="h2">Name it</h2></div>
        <TextField label="Title" maxLength={60} placeholder={category === 'activity' ? 'e.g. November 50 km Walk' : 'e.g. 3 Litres a Day'} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="field">
          <label htmlFor="desc">Description <span className="muted">(optional)</span></label>
          <textarea id="desc" className="input" style={{ minHeight: 84, padding: '12px 15px', resize: 'none' }} maxLength={200} placeholder="One or two lines members will see" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        </section>

        <section className="form-sec">
        <div className="form-sec-h"><span className="num">4</span><h2 className="h2">Dates</h2></div>
        <div className="grid2">
          <TextField label="Starts" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <TextField label="Ends" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          <TextField label="Registration opens" type="date" value={regOpens} onChange={(e) => setRegOpens(e.target.value)} />
          <TextField label="Last date to join" type="date" value={joinBy} max={end} onChange={(e) => setJoinBy(e.target.value)} />
        </div>
        </section>

        <section className="form-sec">
          <div className="form-sec-h"><span className="num">5</span><h2 className="h2">Who can join</h2></div>
          <label className="card row" style={{ gap: 12, padding: 14 }} htmlFor="aud-on">
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="strong" style={{ display: 'block' }}>Only for some members</span>
              <span className="small muted">{limit ? 'Only members who match will see this challenge.' : 'Off: everyone can see and join.'}</span>
            </span>
            <input id="aud-on" type="checkbox" className="sw" checked={limit} onChange={(e) => setLimit(e.target.checked)} />
          </label>
          {limit ? (
            <div className="card stack">
              <label className="row" style={{ justifyContent: 'space-between' }} htmlFor="age-on">
                <span><span className="strong" style={{ display: 'block' }}>By age</span><span className="small muted">Uses members’ birthdays (never shown to you)</span></span>
                <input id="age-on" type="checkbox" className="sw" checked={ageOn} onChange={(e) => setAgeOn(e.target.checked)} />
              </label>
              {ageOn ? (
                <>
                  <div className="chip-row wrap">
                    {([['', '17', 'Under 18'], ['18', '35', '18–35'], ['35', '55', '35–55'], ['55', '', '55+'], ['60', '', '60+']] as const).map(([lo, hi, l]) => (
                      <button key={l} type="button" className="chip" aria-pressed={minAge === lo && maxAge === hi} onClick={() => { setMinAge(lo); setMaxAge(hi); }}>{l}</button>
                    ))}
                  </div>
                  <div className="grid2">
                    <TextField label="From age" type="number" inputMode="numeric" placeholder="Any" value={minAge} onChange={(e) => setMinAge(e.target.value)} />
                    <TextField label="To age" type="number" inputMode="numeric" placeholder="Any" value={maxAge} onChange={(e) => setMaxAge(e.target.value)} />
                  </div>
                </>
              ) : null}
              <div style={{ height: 1, background: 'var(--line)' }} />
              <MultiPicker label="Countries" title="Which countries?" placeholder="Any country" values={countries} onChange={(v) => { setCountries(v); if (!v.includes('India')) setStates([]); }}
                options={COUNTRY_LIST.map((c) => ({ value: c, label: c }))} />
              {countries.includes('India') ? (
                <MultiPicker label="Indian states" title="Which states?" placeholder="All of India" values={states} onChange={setStates}
                  options={INDIAN_STATES.map((x) => ({ value: x, label: x }))} />
              ) : null}
              <p className="hint">Members who don’t match won’t see it at all. Leave a field empty to include everyone for that part.</p>
            </div>
          ) : null}
        </section>

        {preview ? (
          <section className="stack tight">
            <h2 className="h2">Members will see</h2>
            <PreviewCard c={preview} />
          </section>
        ) : null}

        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>Publish challenge</Button>
      </form>
    </Screen>
  );
}

function PreviewCard({ c }: { c: NewChallenge }) {
  const full = { ...c, id: 'preview', cancelled: false, created_at: '', member_count: 0, joined: false, my_daily_target: null, my_reminder: null };
  const look = lookOf(full);
  const h = habitByKey(c.habit_key);
  return (
    <div className="card cc open" style={{ ['--c' as string]: look.color }}>
      <div className="cc-top">
        <span className="sp"><Icon name={look.icon} /></span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="cc-t" style={{ display: 'block' }}>{c.title}</span>
          <span className="cc-s">{look.kind} · {fmtRange(c.start_date, c.end_date)}</span>
        </span>
      </div>
      <p className="small" style={{ color: 'var(--ink-2)' }}>{goalText(full)}{h ? ` · ${habitGoalText(h, c.daily_target ?? h.goal ?? 0)}` : ''}</p>
      {hasAudience(c) ? <span className="aud-tag" style={{ alignSelf: 'flex-start' }}><Icon name="users" />Only for: {audienceText(c)}</span> : null}
    </div>
  );
}
