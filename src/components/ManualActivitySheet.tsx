import { useEffect, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { Button, ErrorText } from './Form';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { useStore } from '../lib/store';
import { data } from '../lib/data';
import { friendlyError } from '../lib/errors';
import { addDays, fmtDay, today } from '../lib/dates';
import { readScreenshot } from '../lib/readshot';
import { SPORTS, type Sport } from '../lib/types';

type Step = 'choose' | 'reading' | 'form';

/**
 * Add an activity without Strava: from a screenshot of another fitness app (read on the phone, then checked
 * by the member) or typed in by hand. Steps are kept; distance is worked out from steps when not given.
 */
export function ManualActivitySheet({ open, onClose, start = 'choose' }: { open: boolean; onClose: () => void; start?: 'choose' | 'shot' | 'manual' }) {
  const { reload } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('choose');
  const [source, setSource] = useState<'manual' | 'screenshot'>('manual');
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [found, setFound] = useState<string[] | null>(null);
  const [sport, setSport] = useState<Sport>('walk');
  const [date, setDate] = useState(today());
  const [steps, setSteps] = useState('');
  const [km, setKm] = useState('');
  const [hh, setHh] = useState('');
  const [mm, setMm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep('choose'); setSource('manual'); setPreview(null); setProgress(0); setFound(null);
    setSport('walk'); setDate(today()); setSteps(''); setKm(''); setHh(''); setMm(''); setErr(null);
  };
  useEffect(() => {
    if (!open) return;
    reset();
    if (start === 'manual') setStep('form');
    if (start === 'shot') setTimeout(() => fileRef.current?.click(), 50);
  }, [open, start]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setSource('screenshot'); setErr(null); setStep('reading'); setProgress(0);
    setPreview(URL.createObjectURL(f));
    try {
      const g = await readScreenshot(f, setProgress);
      const got: string[] = [];
      if (g.sport) setSport(g.sport);
      if (g.steps !== null && g.sport !== 'ride') { setSteps(String(g.steps)); got.push(`${g.steps.toLocaleString('en-IN')} steps`); }
      if (g.km !== null) { setKm(String(g.km)); got.push(`${g.km} km`); }
      if (g.minutes !== null) { setHh(String(Math.floor(g.minutes / 60) || '')); setMm(String(g.minutes % 60)); got.push(`${g.minutes} min`); }
      setFound(got);
    } catch {
      setFound([]);
      setErr('We couldn’t read this picture. Please type the numbers below.');
    }
    setStep('form');
  };

  const save = async () => {
    const st = steps.trim() ? parseInt(steps.replace(/\D/g, ''), 10) : null;
    const k = km.trim() ? parseFloat(km.replace(',', '.')) : null;
    const mins = (parseInt(hh || '0', 10) || 0) * 60 + (parseInt(mm || '0', 10) || 0);
    if (!st && !k) { setErr(sport === 'ride' ? 'Add the distance.' : 'Add the steps or the distance.'); return; }
    if (st !== null && (st < 1 || st > 100000)) { setErr('Steps should be between 1 and 100,000.'); return; }
    if (k !== null && !(k > 0)) { setErr('Check the distance.'); return; }
    setBusy(true); setErr(null);
    try {
      await data.addManualActivity({ sport, date, time: null, km: k, steps: sport === 'ride' ? null : st, moving_s: mins ? mins * 60 : null, source });
      await reload();
      toast(`${SPORTS[sport].verb} added for ${date === today() ? 'today' : fmtDay(date)}`);
      onClose();
    } catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), -i));
  const estKm = !km && steps ? (parseInt(steps, 10) || 0) / (sport === 'run' ? 1100 : 1300) : null;

  return (
    <Sheet open={open} onClose={onClose} label="Add an activity without Strava">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      {step === 'choose' ? (
        <div className="stack">
          <div className="stack tight">
            <p className="eyebrow">Without Strava</p>
            <h2 className="h1" style={{ fontSize: 26 }}>Add an activity</h2>
            <p className="small muted">From another fitness app, or type it in. It counts for your challenges just like a Strava activity.</p>
          </div>
          <button className="opt-tile" onClick={() => fileRef.current?.click()}>
            <span className="sp" style={{ ['--c' as string]: 'var(--ride)' }}><Icon name="camera" /></span>
            <span className="grow"><span className="strong" style={{ display: 'block' }}>Upload a screenshot</span><span className="small muted">From Google Fit, Samsung Health, Apple Health or any step counter. We read the steps, distance and time for you.</span></span>
            <Icon name="chev" />
          </button>
          <button className="opt-tile" onClick={() => { setSource('manual'); setStep('form'); }}>
            <span className="sp" style={{ ['--c' as string]: 'var(--good)' }}><Icon name="edit" /></span>
            <span className="grow"><span className="strong" style={{ display: 'block' }}>Enter by hand</span><span className="small muted">Type your steps, or the distance and time.</span></span>
            <Icon name="chev" />
          </button>
          <p className="legal">Activities added this way are marked “from screenshot” or “added by hand”, so admins can see where they came from.</p>
        </div>
      ) : step === 'reading' ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          {preview ? <img className="shot-prev" src={preview} alt="Your screenshot" /> : null}
          <p className="strong">Reading your screenshot…</p>
          <div className="bar" style={{ width: '100%', ['--c' as string]: 'var(--ride)' }}><i style={{ width: `${Math.max(6, progress * 100)}%` }} /></div>
          <p className="small muted">This happens on your phone. The picture isn’t uploaded. The first time takes a little longer.</p>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="stack tight">
            <p className="eyebrow">{source === 'screenshot' ? 'From your screenshot' : 'Enter by hand'}</p>
            <h2 className="h1" style={{ fontSize: 26 }}>{source === 'screenshot' ? 'Check the numbers' : 'Add an activity'}</h2>
          </div>
          {source === 'screenshot' ? (
            <div className="shot-found">
              {preview ? <img className="shot-thumb" src={preview} alt="" /> : null}
              <p className="small">{found?.length ? <>We found <b>{found.join(', ')}</b>. Please check and fix anything that’s off.</> : 'We couldn’t find steps or distance in this picture. Please type them below.'}</p>
            </div>
          ) : null}
          <div className="field">
            <label>Type</label>
            <div className="seg">
              {(['walk', 'run', 'ride'] as Sport[]).map((s) => <button key={s} type="button" aria-selected={sport === s} onClick={() => setSport(s)}>{SPORTS[s].verb}</button>)}
            </div>
          </div>
          <div className="field">
            <label>Day</label>
            <div className="chip-row">
              {days.map((d, i) => <button key={d} type="button" className="chip" aria-pressed={date === d} onClick={() => setDate(d)}>{i === 0 ? 'Today' : i === 1 ? 'Yesterday' : fmtDay(d)}</button>)}
            </div>
          </div>
          {sport !== 'ride' ? (
            <div className="field">
              <label htmlFor="m-steps">Steps</label>
              <div className="input-wrap">
                <input id="m-steps" className="input has-unit" inputMode="numeric" placeholder="e.g. 8500" value={steps}
                  onChange={(e) => { setSteps(e.target.value.replace(/\D/g, '')); setErr(null); }} />
                <span className="unit">steps</span>
              </div>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="m-km">Distance{sport !== 'ride' ? <span className="muted"> · optional if you add steps</span> : null}</label>
            <div className="input-wrap">
              <input id="m-km" className="input has-unit" inputMode="decimal" placeholder={estKm ? `≈ ${estKm.toFixed(2)} from your steps` : 'e.g. 4.25'} value={km}
                onChange={(e) => { setKm(e.target.value.replace(/[^\d.,]/g, '')); setErr(null); }} />
              <span className="unit">km</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="m-hh">Time <span className="muted">· optional</span></label>
            <div className="row" style={{ gap: 10 }}>
              <div className="input-wrap grow">
                <input id="m-hh" className="input has-unit" inputMode="numeric" placeholder="0" maxLength={2} value={hh} aria-label="Hours" onChange={(e) => setHh(e.target.value.replace(/\D/g, ''))} />
                <span className="unit">h</span>
              </div>
              <div className="input-wrap grow">
                <input className="input has-unit" inputMode="numeric" placeholder="45" maxLength={2} value={mm} aria-label="Minutes" onChange={(e) => setMm(e.target.value.replace(/\D/g, ''))} />
                <span className="unit">min</span>
              </div>
            </div>
          </div>
          <ErrorText>{err}</ErrorText>
          <Button type="submit" loading={busy}>Save activity</Button>
          <Button type="button" variant="ghost" onClick={() => (source === 'screenshot' ? fileRef.current?.click() : setStep('choose'))}>{source === 'screenshot' ? 'Use another screenshot' : 'Back'}</Button>
        </form>
      )}
    </Sheet>
  );
}
