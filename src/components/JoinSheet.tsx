import { joinByText, fmtWindow } from '../lib/dates';
import { ReminderPicker } from './TimeWheel';
import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { Button, ErrorText } from './Form';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { lookOf } from '../lib/look';
import { goalText } from '../lib/progress';
import { habitByKey, habitGoalText } from '../lib/habits';
import { friendlyError } from '../lib/errors';
import type { Challenge } from '../lib/types';
import { enablePush, pushState } from '../lib/push';
import { TERMS_VERSION, TermsStep } from './Terms';
import { ageRangeText } from '../lib/agetargets';

const KM_TARGETS = [0, 2, 3, 5, 8];

/** Join a challenge. Activity challenges can add an optional personal daily km target (the green ring). */
export function JoinSheet({ c, onClose, onJoined }: { c: Challenge | null; onClose: () => void; onJoined?: (c: Challenge) => void }) {
  const { reload } = useStore();
  const toast = useToast();
  const [t, setT] = useState(0);
  const [rem, setRem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'options' | 'terms'>('options');
  useEffect(() => { setRem(null); setT(0); setErr(null); setStep('options'); }, [c?.id]);
  if (!c) return null;
  const look = lookOf(c);
  const h = habitByKey(c.habit_key);
  const band = c.my_band !== null && c.my_band !== undefined ? c.age_targets?.[c.my_band] : null;
  const join = async () => {
    setBusy(true); setErr(null);
    try {
      const reminder = (rem ?? (c.category === 'habit' ? '20:00' : '')) || null;
      // Ask for notification permission first, while we still have the tap.
      if (reminder && (await pushState()) === 'off') await enablePush().catch(() => null);
      await data.join(c.id, c.category === 'activity' && t ? t : null, reminder, TERMS_VERSION);
      await reload();
      toast(`You joined ${c.title}`);
      onJoined?.(c);
      onClose();
    } catch (e) { setErr(friendlyError(e)); setStep('options'); }
    finally { setBusy(false); }
  };
  if (step === 'terms') {
    return (
      <Sheet open={!!c} onClose={onClose} label={`Terms for ${c.title}`}>
        <div style={{ ['--c' as string]: look.color }}><TermsStep title={c.title} busy={busy} onAgree={join} onBack={() => setStep('options')} /></div>
      </Sheet>
    );
  }
  return (
    <Sheet open={!!c} onClose={onClose} label={`Join ${c.title}`}>
      <div className="stack" style={{ ['--c' as string]: look.color }}>
        <span className="sp lg"><Icon name={look.icon} /></span>
        <div className="stack tight">
          <p className="eyebrow">Join challenge</p>
          <h2 className="h1" style={{ fontSize: 26 }}>{c.title}</h2>
          <p className="lead">{goalText(c)} · {fmtWindow(c)}</p>
          {band ? <span className="aud-tag" style={{ alignSelf: 'flex-start' }}><Icon name="user" />Goal set for your age group ({ageRangeText(band)})</span> : null}
        </div>
        {c.category === 'activity' ? (
          <div className="card stack tight">
            <p><span className="strong">Daily target</span> <span className="small muted">· optional</span></p>
            <p className="small muted">Set a personal distance for each day. It adds a green ring to your Today screen.</p>
            <div className="chip-row wrap">
              {KM_TARGETS.map((k) => <button key={k} className="chip" aria-pressed={t === k} onClick={() => setT(k)}>{k ? `${k} km` : 'No target'}</button>)}
            </div>
            <p className="small muted">Record {c.sport === 'ride' ? 'rides' : c.sport === 'run' ? 'runs' : 'walks'} in Strava, then paste each activity’s link in the app (Activity → Add a Strava activity).</p>
          </div>
        ) : h ? (
          <div className="card stack tight">
            <p className="strong">How it works</p>
            <p className="small muted">
              Each day, log it in the app: {h.kind === 'amount' ? `add ${h.unit} as you go` : h.kind === 'time' ? 'enter the time' : 'tap Yes or Not today'}.
              A day counts when you reach <span className="strong">{habitGoalText(h, c.daily_target ?? h.goal ?? 0).toLowerCase()}</span>.
            </p>
          </div>
        ) : null}
        <div className="card stack tight">
          <p><span className="strong">Daily reminder</span> <span className="small muted">· optional</span></p>
          <p className="small muted">We’ll send a phone notification on days you haven’t logged yet.</p>
          <ReminderPicker title="Remind me at" value={rem ?? (c.category === 'habit' ? '20:00' : '')} onChange={(v) => setRem(v)} />
        </div>
        <ErrorText>{err}</ErrorText>
        <Button className="tint" onClick={() => { setErr(null); setStep('terms'); }}>Continue</Button>
        <p className="legal">{c.member_count} {c.member_count === 1 ? 'member has' : 'members have'} joined · join by {joinByText(c)}</p>
      </div>
    </Sheet>
  );
}
