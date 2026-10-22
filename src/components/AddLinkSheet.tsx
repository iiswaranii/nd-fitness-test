import { useState } from 'react';
import { Sheet } from './Sheet';
import { Button, ErrorText } from './Form';
import { Icon } from './Icon';
import { StravaProfileLink } from './StravaProfileLink';
import { useToast } from './Toast';
import { data, parseStravaLink, stravaUrlIn, type LinkPreview } from '../lib/data';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { friendlyError } from '../lib/errors';
import { addDays, fmtDay, fmtHms, fmtKm, fmtKmExact, today } from '../lib/dates';
import { SPORTS, type Challenge, type Sport } from '../lib/types';

/**
 * Paste a Strava activity link (Strava → activity → Share → Copy link).
 * Strava's public page gives the name, type and date; the member types distance and time from Strava.
 */
export function AddLinkSheet({ open, onClose, forChallenge }: { open: boolean; onClose: () => void; forChallenge?: Challenge | null }) {
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
  const [ss, setSs] = useState('');
  const [sport, setSport] = useState<Sport>('walk');
  const [date, setDate] = useState(today());
  const linked = !!profile?.strava_athlete_id;
  const athlete = linked ? profile?.strava_athlete_name ?? 'your Strava profile' : null;

  const reset = () => { setUrl(''); setPreview(null); setKm(''); setHh(''); setMm(''); setSs(''); setErr(null); setDate(today()); setSport('walk'); };
  const close = () => { reset(); onClose(); };

  const paste = async () => {
    try { const t = (await navigator.clipboard.readText()).trim(); setUrl(/data-embed-id/i.test(t) ? t : stravaUrlIn(t) ?? t); setErr(null); }
    catch { setErr('Couldn’t read the clipboard. Long-press the box and choose Paste.'); }
  };

  const done = async (r: Awaited<ReturnType<typeof data.addActivityByLink>>) => {
    if (r.needsStats) {
      const p = r.preview;
      setPreview(p);
      if (p.sport) setSport(p.sport); else if (forChallenge?.sport) setSport(forChallenge.sport);
      if (p.date) setDate(p.date);
      setKm(p.km ? String(p.km) : '');
      if (p.seconds) { const t = Math.round(p.seconds); setHh(String(Math.floor(t / 3600))); setMm(String(Math.floor((t % 3600) / 60))); setSs(String(t % 60)); } else { setHh(''); setMm(''); setSs(''); }
      return;
    }
    await reload();
    if (r.firstLink) await refreshProfile();
    toast(`Added: ${fmtKm(r.activity.km)} km ${SPORTS[r.activity.sport].verb.toLowerCase()}${r.firstLink && r.athleteName ? ` · linked to ${r.athleteName}` : ''}`);
    close();
  };

  const submitLink = async (text = url) => {
    if (!parseStravaLink(text)) { setErr('Paste a Strava activity link, like strava.app.link/…'); return; }
    setBusy(true); setErr(null);
    try { await done(await data.addActivityByLink(text)); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const confirmOfficial = async () => {
    setBusy(true); setErr(null);
    try { await done(await data.addActivityByLink(url, undefined, true)); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const submitStats = async () => {
    const k = parseFloat(km.replace(',', '.'));
    const secs = (parseInt(hh || '0', 10) || 0) * 3600 + (parseInt(mm || '0', 10) || 0) * 60 + (parseInt(ss || '0', 10) || 0);
    if ((parseInt(mm || '0', 10) || 0) > 59 || (parseInt(ss || '0', 10) || 0) > 59) { setErr('Minutes and seconds go up to 59.'); return; }
    if (!(k > 0)) { setErr('Enter the distance in km, as shown in Strava.'); return; }
    if (secs < 60) { setErr('Enter the time (hours, minutes, seconds), as shown in Strava.'); return; }
    setBusy(true); setErr(null);
    const p = preview;
    const edited = !p?.measured || p.partial || k !== p.km || sport !== p.sport || date !== p.date
      || secs !== Math.round(p.seconds ?? 0);
    try { await done(await data.addActivityByLink(url, { km: k, seconds: secs, sport, date, edited })); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={close} label="Add a Strava activity">
      <span className="sp lg" style={{ ['--c' as string]: 'var(--strava)' }}><Icon name="link" /></span>
      {!linked ? <StravaProfileLink /> : <>

      {!preview ? (
        <>
          <div className="stack tight">
            <h2 className="h1" style={{ fontSize: 24 }}>Add from Strava</h2>
            {forChallenge ? <p className="small strong" style={{ color: 'var(--strava)' }}>For {forChallenge.title}</p> : null}
            <p className="lead">In Strava, open your walk, run or ride, tap <span className="strong">Share → Copy link</span>, then paste it here. We fill in the details for you to check.</p>
          </div>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); submitLink(); }}>
            <div className="field">
              <label htmlFor="sl">Strava activity link</label>
              <div className="input-wrap">
                <input id="sl" className="input has-trail" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder="https://strava.app.link/…" value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }}
                  onPaste={(e) => { const t = e.clipboardData.getData('text'); const u = /data-embed-id/i.test(t) ? null : stravaUrlIn(t); if (u) { e.preventDefault(); setUrl(u); setErr(null); } }} />
                <button type="button" className="trail-btn" onClick={paste} aria-label="Paste from clipboard"><Icon name="paste" /></button>
              </div>
            </div>
            <ErrorText>{err}</ErrorText>
            <Button type="submit" variant="strava" loading={busy} disabled={!url.trim()}>{busy ? 'Reading activity…' : 'Continue'}</Button>
            <p className="legal">
              {athlete ? <>Activities by <span className="strong">{athlete}</span> on Strava count for you.</>
                : null}
            </p>
            <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setHelp((h) => !h)}>{help ? 'Hide help' : 'Link not working?'}</button>
            {help ? <LinkHelp /> : null}
          </form>
        </>
      ) : preview.official ? (
        <div className="stack">
          <div className="stack tight">
            <h2 className="h1" style={{ fontSize: 24 }}>{preview.title ?? 'Your activity'}</h2>
            {preview.athleteName ? <p className="lead">{preview.athleteName} on Strava</p> : null}
          </div>
          <div className="kv">
            <div><div className="k">Type</div><div className="v">{preview.sportType ?? (preview.sport ? SPORTS[preview.sport].verb : '—')}</div></div>
            <div><div className="k">Date</div><div className="v">{preview.date ? fmtDay(preview.date) : '—'}{preview.time ? ` · ${preview.time.slice(0, 5)}` : ''}</div></div>
            <div><div className="k">Distance</div><div className="v">{fmtKmExact(preview.km ?? 0)} km</div></div>
            <div><div className="k">Time</div><div className="v">{fmtHms(preview.seconds ?? 0)}</div></div>
          </div>
          {forChallenge?.sport && preview.sport && preview.sport !== forChallenge.sport ? (
            <p className="notice">This is a {SPORTS[preview.sport].verb.toLowerCase()}, so it won’t count toward {forChallenge.title}. It still counts for any {SPORTS[preview.sport].verb.toLowerCase()} challenge you’ve joined.</p>
          ) : null}
          <p className="small muted">Exactly as recorded in Strava. To change anything, edit the activity in Strava first, then paste the link again.</p>
          <ErrorText>{err}</ErrorText>
          <Button variant="strava" loading={busy} onClick={confirmOfficial}>Submit</Button>
          <Button type="button" variant="ghost" onClick={() => { setPreview(null); setErr(null); }}>Back</Button>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); submitStats(); }}>
          <div className="stack tight">
            <h2 className="h1" style={{ fontSize: 24 }}>{preview.title ?? 'Your activity'}</h2>
            {preview.sport || preview.date || preview.athleteName ? (
              <p className="lead">{[preview.sportType, preview.date ? fmtDay(preview.date) : null, preview.athleteName].filter(Boolean).join(' · ')}</p>
            ) : null}
            {preview.partial ? (
              <p className="notice">Part of this route is hidden by a Strava privacy zone, so the distance below is too short. Please correct it to match Strava.</p>
            ) : preview.measured ? (
              <p className="small muted">We measured this from the activity’s route. Check it matches Strava and fix anything that’s off, then save.</p>
            ) : (
              <p className="small muted">We couldn’t measure this activity’s route (for example a treadmill walk). Type the distance and time as Strava shows them.</p>
            )}
          </div>
          {forChallenge?.sport && sport !== forChallenge.sport ? (
            <p className="notice">This is a {SPORTS[sport].verb.toLowerCase()}, so it won’t count toward {forChallenge.title}. It still counts for any {SPORTS[sport].verb.toLowerCase()} challenge you’ve joined.</p>
          ) : null}

            <div className="field">
              <label>Type</label>
              <div className="chip-row wrap">
                {(['walk', 'run', 'ride'] as Sport[]).map((s) => <button key={s} type="button" className="chip" aria-pressed={sport === s} onClick={() => setSport(s)}>{SPORTS[s].verb}</button>)}
              </div>
            </div>
            <div className="field">
              <label htmlFor="ad">Date</label>
              <input id="ad" className="input" type="date" value={date} min={addDays(today(), -60)} max={today()} onChange={(e) => setDate(e.target.value)} />
            </div>

          <div className="field">
            <label htmlFor="akm">Distance</label>
            <div className="input-wrap">
              <input id="akm" className="input has-unit" inputMode="decimal" placeholder="e.g. 4.25" value={km}
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
                <span className="unit">m</span>
              </div>
              <div className="input-wrap grow">
                <input className="input has-unit" inputMode="numeric" placeholder="00" maxLength={2} value={ss} aria-label="Seconds"
                  onChange={(e) => { setSs(e.target.value.replace(/\D/g, '')); setErr(null); }} />
                <span className="unit">s</span>
              </div>
            </div>
          </div>

          <ErrorText>{err}</ErrorText>
          <Button type="submit" variant="strava" loading={busy}>Save activity</Button>
          <Button type="button" variant="ghost" onClick={() => { setPreview(null); setErr(null); }}>Back</Button>
        </form>
      )}
      </>}
    </Sheet>
  );
}

function LinkHelp() {
  return (
    <div className="card stack tight" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
      <p className="small">Use <span className="strong">Share → Copy link</span> on the activity itself, not your profile.</p>
      <p className="small">The activity must be visible to <span className="strong">Everyone</span>: in Strava, open it → ⋯ → Edit → Who can view → Everyone.</p>
      <p className="small muted">Only walks, hikes, runs and rides count. Strava doesn’t share step counts.</p>
    </div>
  );
}
