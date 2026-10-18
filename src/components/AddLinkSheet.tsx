import { useState } from 'react';
import { Sheet } from './Sheet';
import { Button, ErrorText } from './Form';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { data, parseStravaLink, type LinkPreview } from '../lib/data';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { friendlyError } from '../lib/errors';
import { addDays, fmtDay, fmtKm, today } from '../lib/dates';
import { SPORTS, type Sport } from '../lib/types';

/**
 * Paste a Strava activity link (Strava → activity → Share → Copy link).
 * Strava's public page gives the name, type and date; the member types distance and time from Strava.
 */
export function AddLinkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { reload } = useStore();
  const { profile, refreshProfile } = useSession();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [km, setKm] = useState('');
  const [hh, setHh] = useState('');
  const [mm, setMm] = useState('');
  const [sport, setSport] = useState<Sport>('walk');
  const [date, setDate] = useState(today());
  const athlete = profile?.strava_connected ? profile.strava_athlete_name : null;

  const reset = () => { setUrl(''); setPreview(null); setKm(''); setHh(''); setMm(''); setErr(null); setDate(today()); setSport('walk'); };
  const close = () => { reset(); onClose(); };

  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); setUrl(t.trim()); setErr(null); }
    catch { setErr('Couldn’t read the clipboard. Long-press the box and choose Paste.'); }
  };

  const done = async (r: Awaited<ReturnType<typeof data.addActivityByLink>>) => {
    if (r.needsStats) { setPreview(r.preview); if (r.preview.sport) setSport(r.preview.sport); if (r.preview.date) setDate(r.preview.date); return; }
    await reload();
    if (r.firstLink) await refreshProfile();
    toast(`Added: ${fmtKm(r.activity.km)} km ${SPORTS[r.activity.sport].verb.toLowerCase()}${r.firstLink && r.athleteName ? ` · linked to ${r.athleteName}` : ''}`);
    close();
  };

  const submitLink = async (text = url) => {
    if (!parseStravaLink(text)) { setErr('Paste a Strava link (strava.app.link/…) or the Embed code from Strava.'); return; }
    setBusy(true); setErr(null);
    try { await done(await data.addActivityByLink(text)); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const submitStats = async () => {
    const k = parseFloat(km.replace(',', '.'));
    const secs = (parseInt(hh || '0', 10) || 0) * 3600 + (parseInt(mm || '0', 10) || 0) * 60;
    if (!(k > 0)) { setErr('Enter the distance in km, as shown in Strava.'); return; }
    if (secs < 60) { setErr('Enter the time (hours and minutes), as shown in Strava.'); return; }
    setBusy(true); setErr(null);
    try { await done(await data.addActivityByLink(url, { km: k, seconds: secs, sport, date })); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={close} label="Add a Strava activity">
      <span className="sp lg" style={{ ['--c' as string]: 'var(--strava)' }}><Icon name="link" /></span>

      {!preview ? (
        <>
          <div className="stack tight">
            <h2 className="h1" style={{ fontSize: 24 }}>Add from Strava</h2>
            <p className="lead">Paste your activity’s <span className="strong">Embed code</span> to add distance and time automatically, or its <span className="strong">link</span> and type them in.</p>
          </div>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); submitLink(); }}>
            <div className="field">
              <label htmlFor="sl">Embed code or link</label>
              <div className="input-wrap">
                <input id="sl" className="input has-trail" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder="<div class=&quot;strava-embed… or https://strava.app.link/…" value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} />
                <button type="button" className="trail-btn" onClick={paste} aria-label="Paste from clipboard"><Icon name="paste" /></button>
              </div>
            </div>
            <ErrorText>{err}</ErrorText>
            <Button type="submit" variant="strava" loading={busy} disabled={!url.trim()}>{busy ? 'Reading activity…' : 'Continue'}</Button>
            <p className="legal">
              {athlete ? <>Activities by <span className="strong">{athlete}</span> on Strava count for you.</>
                : <>Your first link connects your Strava name to your account. After that, only your own activities can be added.</>}
            </p>
            <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setHelp((h) => !h)}>{help ? 'Hide help' : 'How do I get the Embed code?'}</button>
            {help ? <EmbedHelp /> : null}
          </form>
        </>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); submitStats(); }}>
          <div className="stack tight">
            <h2 className="h1" style={{ fontSize: 24 }}>{preview.title ?? 'Your activity'}</h2>
            {preview.sport || preview.date || preview.athleteName ? (
              <p className="lead">{[preview.sportType, preview.date ? fmtDay(preview.date) : null, preview.athleteName].filter(Boolean).join(' · ')}</p>
            ) : null}
            <p className="small muted">Strava doesn’t share distance and time through a link. Type them in as Strava shows them, or paste the activity’s Embed code to fill them automatically.</p>
            <Button type="button" variant="secondary" loading={busy} onClick={async () => {
              try { const t = (await navigator.clipboard.readText()).trim(); if (!/data-token=/i.test(t)) { setErr('Copy the Embed code from Strava first (see below), then tap again.'); setHelp(true); return; } setUrl(t); setPreview(null); await submitLink(t); }
              catch { setErr('Couldn’t read the clipboard. Tap Back and paste the Embed code in the box.'); }
            }}>Paste Embed code instead</Button>
            {help ? <EmbedHelp /> : null}
          </div>


          {!preview.sport ? (
            <div className="field">
              <label>Type</label>
              <div className="chip-row wrap">
                {(['walk', 'run', 'ride'] as Sport[]).map((s) => <button key={s} type="button" className="chip" aria-pressed={sport === s} onClick={() => setSport(s)}>{SPORTS[s].verb}</button>)}
              </div>
            </div>
          ) : null}
          {!preview.date ? (
            <div className="field">
              <label htmlFor="ad">Date</label>
              <input id="ad" className="input" type="date" value={date} min={addDays(today(), -60)} max={today()} onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="akm">Distance</label>
            <div className="input-wrap">
              <input id="akm" className="input has-unit" inputMode="decimal" placeholder="e.g. 4.25" value={km} autoFocus
                onChange={(e) => { setKm(e.target.value.replace(/[^\d.,]/g, '')); setErr(null); }} />
              <span className="unit">km</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="ahh">Time</label>
            <div className="row" style={{ gap: 10 }}>
              <div className="input-wrap grow">
                <input id="ahh" className="input has-unit" inputMode="numeric" placeholder="0" maxLength={2} value={hh} aria-label="Hours"
                  onChange={(e) => { setHh(e.target.value.replace(/\D/g, '')); setErr(null); }} />
                <span className="unit">h</span>
              </div>
              <div className="input-wrap grow">
                <input className="input has-unit" inputMode="numeric" placeholder="45" maxLength={2} value={mm} aria-label="Minutes"
                  onChange={(e) => { setMm(e.target.value.replace(/\D/g, '')); setErr(null); }} />
                <span className="unit">min</span>
              </div>
            </div>
          </div>

          <ErrorText>{err}</ErrorText>
          <Button type="submit" variant="strava" loading={busy}>Add activity</Button>
          <Button type="button" variant="ghost" onClick={() => { setPreview(null); setErr(null); }}>Back</Button>
        </form>
      )}
    </Sheet>
  );
}

function EmbedHelp() {
  return (
    <div className="card stack tight" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
      <p className="small"><span className="strong">Get the Embed code</span> (once per activity):</p>
      <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
        <li>Open <span className="strong">strava.com</span> in your browser and log in (on iPhone: Safari → aA → Request Desktop Website).</li>
        <li>Open the activity and tap the <span className="strong">Share</span> icon → <span className="strong">Embed</span>.</li>
        <li>Copy the code and paste it here.</li>
      </ol>
      <p className="small muted">The activity and your Strava profile must be visible to Everyone. Only walks, hikes, runs and rides count.</p>
    </div>
  );
}
