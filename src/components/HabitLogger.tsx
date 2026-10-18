import { useEffect, useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import { Button, ErrorText } from './Form';
import { Icon } from './Icon';
import { Bar } from './Ring';
import { useToast } from './Toast';
import { useStore } from '../lib/store';
import { dayMet, fmtAmount, fmtClock, habitByKey, habitGoalText, type Habit } from '../lib/habits';
import { addDays, parse, relDay, today } from '../lib/dates';
import { friendlyError } from '../lib/errors';
import { lookOf } from '../lib/look';
import type { Challenge } from '../lib/types';

/** How many days back a member may log or correct. */
export const EDIT_DAYS = 4;

/**
 * Log a habit for today or one of the last few days. One action = one save:
 * the sheet closes and a short confirmation appears.
 *  - amount → tap a size (glass, bottle…) or enter an amount; "Edit total" corrects the day
 *  - check  → Yes, done / Not today
 *  - time   → pick the time, Save
 */
export function HabitLogger({ c, open, onClose }: { c: Challenge | null; open: boolean; onClose: () => void }) {
  if (!c) return null;
  return (
    <Sheet open={open} onClose={onClose} label={`Log ${c.title}`}>
      <LoggerBody key={c.id} c={c} onClose={onClose} />
    </Sheet>
  );
}

type Commit = (value: number | null, entries: number[], msg: string) => Promise<void>;

function LoggerBody({ c, onClose }: { c: Challenge; onClose: () => void }) {
  const h = habitByKey(c.habit_key);
  const { logs, saveLog } = useStore();
  const toast = useToast();
  const look = lookOf(c);
  const t = today();
  const days = Array.from({ length: EDIT_DAYS }, (_, i) => addDays(t, -i)).filter((d) => d >= c.start_date && d <= c.end_date);
  const [day, setDay] = useState(days[0] ?? t);
  const existing = logs.find((l) => l.challenge_id === c.id && l.date === day) ?? null;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!h) return <p className="lead">This habit isn’t available in this version of the app.</p>;
  const target = c.daily_target ?? h.goal ?? 0;
  const dayLabel = day === t ? 'today' : relDay(day).toLowerCase() === 'yesterday' ? 'yesterday' : relDay(day);

  // Save, close the sheet, confirm.
  const commit: Commit = async (value, entries, msg) => {
    setErr(null); setBusy(true);
    try {
      await saveLog(c.id, day, value, entries);
      onClose();
      toast(msg);
    } catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ ['--c' as string]: look.color }}>
      <div className="row" style={{ gap: 12 }}>
        <span className="sp lg"><Icon name={look.icon} /></span>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{c.title}</p>
          <h2 className="h2" style={{ fontSize: 22 }}>{h.name}</h2>
          <p className="small muted">Goal: {habitGoalText(h, target)}</p>
        </div>
      </div>

      {days.length > 1 ? (
        <div className="day-pick" role="tablist" aria-label="Which day">
          {days.map((d) => {
            const l = logs.find((x) => x.challenge_id === c.id && x.date === d);
            const met = dayMet(h, target, l?.value);
            return (
              <button key={d} role="tab" aria-selected={day === d} onClick={() => setDay(d)}>
                <span>{d === t ? 'Today' : d === addDays(t, -1) ? 'Yest.' : parse(d).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <b>{parse(d).getDate()}</b>
                <i className={met ? 'met' : l ? 'miss' : ''} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}

      {h.kind === 'amount' ? (
        <AmountLogger key={day} h={h} target={target} value={existing?.value ?? null} entries={existing?.entries ?? []} commit={commit} busy={busy} dayLabel={dayLabel} />
      ) : h.kind === 'check' ? (
        <CheckLogger key={day} h={h} value={existing?.value ?? null} commit={commit} busy={busy} />
      ) : (
        <TimeLogger key={day} h={h} target={target} value={existing?.value ?? null} commit={commit} busy={busy} />
      )}

      <ErrorText>{err}</ErrorText>
      {h.hint ? <p className="hint">{h.hint}</p> : null}
      <p className="legal">You can log or correct the last {EDIT_DAYS} days.</p>
    </div>
  );
}

/* ---------- amount: water, steps, minutes, sugar… ---------- */

function sizeLabel(h: Habit, v: number): string {
  if (h.key === 'water') return v <= 150 ? 'Small cup' : v <= 250 ? 'Glass' : v <= 500 ? 'Bottle' : 'Large bottle';
  return h.unit ?? '';
}

function AmountLogger({ h, target, value, entries, commit, busy, dayLabel }: {
  h: Habit; target: number; value: number | null; entries: number[]; commit: Commit; busy: boolean; dayLabel: string;
}) {
  const total = value ?? 0;
  const atMost = h.dir === 'atMost';
  const isWeight = h.key === 'weigh-in';
  const [mode, setMode] = useState<'add' | 'edit'>(isWeight ? 'edit' : 'add');
  const [amount, setAmount] = useState<string>(String(h.presets?.[1] ?? h.presets?.[0] ?? h.step ?? 1));
  const [edit, setEdit] = useState<string>(value === null ? '' : String(value));
  const met = dayMet(h, target, value);
  const pct = target ? Math.min(100, (total / target) * 100) : 0;

  const add = (n: number) => {
    if (!(n > 0) || busy) return;
    const next = +(total + n).toFixed(2);
    const reached = !atMost && !met && dayMet(h, target, next);
    const over = atMost && next > target;
    commit(next, [...entries, n],
      reached ? `Added ${fmtAmount(n, h.unit)} · daily goal reached!`
        : over ? `Added ${fmtAmount(n, h.unit)} · ${fmtAmount(next, h.unit)} ${dayLabel}, over the limit`
          : `Added ${fmtAmount(n, h.unit)} · ${fmtAmount(next, h.unit)} ${dayLabel}`);
  };

  return (
    <div className="stack">
      {!isWeight ? (
        <div className="card stack tight">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="big">{fmtAmount(total)}<small>{h.unit}</small></span>
            <span className={`pill ${met ? 'good' : atMost && value !== null ? 'bad' : ''}`}>
              {met ? (atMost ? 'Within limit' : 'Goal met') : atMost ? (value === null ? 'Not logged' : 'Over limit') : `${fmtAmount(Math.max(0, target - total))} to go`}
            </span>
          </div>
          <Bar pct={pct} color={atMost && !met && value !== null ? 'var(--bad)' : 'var(--c)'} />
          <p className="small muted">{atMost ? 'Limit' : 'Goal'} {fmtAmount(target, h.unit)} · logged {dayLabel}</p>
        </div>
      ) : null}

      {mode === 'add' ? (
        <>
          {h.presets && h.presets.length ? (
            <div className="preset-grid">
              {h.presets.map((p) => (
                <button key={p} className="preset" onClick={() => add(p)} disabled={busy} aria-label={`Add ${fmtAmount(p, h.unit)}`}>
                  <Icon name={h.key === 'water' ? 'drop' : 'plus'} />
                  +{fmtAmount(p)}
                  <small>{sizeLabel(h, p)}</small>
                </button>
              ))}
            </div>
          ) : null}
          <div className="stack tight">
            <span className="label">Or add a different amount</span>
            <div className="stepper">
              <button type="button" aria-label="Less" onClick={() => setAmount((v) => String(Math.max(0, +(+v - (h.step ?? 1)).toFixed(2))))}><Icon name="minus" /></button>
              <input className="input" type="number" inputMode="decimal" aria-label={`Amount in ${h.unit}`} value={amount} min={0} onChange={(e) => setAmount(e.target.value)} />
              <button type="button" aria-label="More" onClick={() => setAmount((v) => String(+(+v + (h.step ?? 1)).toFixed(2)))}><Icon name="plus" /></button>
            </div>
            <Button className="tint" loading={busy} onClick={() => add(parseFloat(amount))} disabled={!(parseFloat(amount) > 0)}>
              Add {fmtAmount(parseFloat(amount) || 0, h.unit)}
            </Button>
          </div>
          {atMost && value === null ? (
            <Button variant="secondary" loading={busy} onClick={() => commit(0, [], `Logged: none ${dayLabel}. Well done!`)}>
              <Icon name="check" />None {dayLabel}
            </Button>
          ) : null}
          {value !== null ? (
            <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => { setEdit(String(value)); setMode('edit'); }}>
              <Icon name="edit" className="ic" /> Edit {dayLabel}’s total
            </button>
          ) : null}
        </>
      ) : (
        <form className="stack tight" onSubmit={(e) => {
          e.preventDefault();
          const v = parseFloat(edit);
          if (isWeight) { if (v >= 20 && v <= 250) commit(+v.toFixed(1), [v], `Weight saved for ${dayLabel}`); return; }
          if (edit.trim() === '') { commit(null, [], `Cleared ${dayLabel}’s entry`); return; }
          if (v >= 0) commit(+v.toFixed(2), [v], `Updated: ${fmtAmount(v, h.unit)} ${dayLabel}`);
        }}>
          <label className="label" htmlFor="tot">{isWeight ? `Weight ${dayLabel} (kg)` : `Total for ${dayLabel} (${h.unit})`}</label>
          <input id="tot" className="input" style={{ fontFamily: 'var(--font-d)', fontSize: 22, textAlign: 'center' }} type="number" inputMode="decimal" min="0" step={h.step ?? 1}
            placeholder={isWeight ? 'e.g. 72.4' : '0'} value={edit} onChange={(e) => setEdit(e.target.value)} autoFocus={!isWeight} />
          <Button type="submit" className="tint" loading={busy}>Save</Button>
          {!isWeight ? <button type="button" className="link-btn muted" style={{ alignSelf: 'center' }} onClick={() => setMode('add')}>Back to adding</button> : null}
        </form>
      )}
    </div>
  );
}

/* ---------- check: done / not done ---------- */

function CheckLogger({ h, value, commit, busy }: { h: Habit; value: number | null; commit: Commit; busy: boolean }) {
  return (
    <div className="stack">
      <p className="lead" style={{ color: 'var(--ink)', fontWeight: 600 }}>{h.ask ?? h.name}</p>
      <div className="yn">
        <button className="yes" aria-pressed={value === 1} disabled={busy} onClick={() => commit(1, [], 'Nice work! Logged as done.')}>
          <Icon name="check" />Yes, done
        </button>
        <button className="no" aria-pressed={value === 0} disabled={busy} onClick={() => commit(0, [], 'Logged. Every day is a fresh start.')}>
          <Icon name="x" />Not today
        </button>
      </div>
      {value !== null ? <button className="link-btn muted" style={{ alignSelf: 'center' }} onClick={() => commit(null, [], 'Entry cleared')}>Clear this day</button> : null}
    </div>
  );
}

/* ---------- time: sleep, wake, screens off ---------- */

const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (s: string) => { const [a, b] = s.split(':').map(Number); return a * 60 + (b || 0); };

function TimeLogger({ h, target, value, commit, busy }: { h: Habit; target: number; value: number | null; commit: Commit; busy: boolean }) {
  const nowMin = useMemo(() => { const d = new Date(); return d.getHours() * 60 + Math.floor(d.getMinutes() / 5) * 5; }, []);
  const isBed = h.key.startsWith('sleep') || h.key === 'digital-sunset';
  const [v, setV] = useState<string>(toHHMM(value ?? (isBed ? target : nowMin)));
  useEffect(() => { if (value !== null) setV(toHHMM(value)); }, [value]);
  const mins = fromHHMM(v);
  const ok = dayMet(h, target, mins);
  return (
    <div className="stack">
      <label className="label" htmlFor="t-in">{isBed ? (h.key === 'digital-sunset' ? 'When did you put screens away?' : 'What time did you go to bed?') : 'What time did you get up?'}</label>
      <input id="t-in" className="input time-input" type="time" value={v} onChange={(e) => setV(e.target.value)} />
      <div className="chip-row wrap">
        <button className="chip" onClick={() => setV(toHHMM(nowMin))}><Icon name="clock" />Now</button>
        {[-30, 0, 30].map((d) => (
          <button key={d} className="chip" onClick={() => setV(toHHMM((target + d + 1440) % 1440))}>{fmtClock((target + d + 1440) % 1440)}</button>
        ))}
      </div>
      <p className="small" style={{ color: ok ? 'var(--good)' : 'var(--warn)', fontWeight: 700 }}>
        {ok ? `On time · goal is ${fmtClock(target)}` : `Later than your ${fmtClock(target)} goal`}
      </p>
      <Button className="tint" loading={busy} onClick={() => commit(mins, [], ok ? `Saved ${fmtClock(mins)} · right on time!` : `Saved ${fmtClock(mins)}`)}>
        {value === null ? 'Save' : 'Update'} {fmtClock(mins)}
      </Button>
      {value !== null ? <button className="link-btn muted" style={{ alignSelf: 'center' }} onClick={() => commit(null, [], 'Entry cleared')}>Clear this day</button> : null}
    </div>
  );
}
