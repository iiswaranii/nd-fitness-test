import { useState } from 'react';
import { Button, ErrorText } from './Form';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { data } from '../lib/data';
import { useSession } from '../lib/session';
import { friendlyError } from '../lib/errors';

/**
 * One-time step: the member pastes their own Strava profile link. Its athlete id is saved, and from then on
 * only activities recorded by that athlete can be added.
 */
export function StravaProfileLink({ onDone }: { onDone?: () => void }) {
  const { refreshProfile } = useSession();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const paste = async () => {
    try { setUrl((await navigator.clipboard.readText()).trim()); setErr(null); }
    catch { setErr('Couldn’t read the clipboard. Long-press the box and choose Paste.'); }
  };
  const submit = async () => {
    if (!/strava/i.test(url)) { setErr('Paste your Strava profile link (strava.app.link/… or strava.com/athletes/…).'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await data.linkStravaProfile(url);
      await refreshProfile();
      toast(`Linked to ${r.athleteName ?? 'your Strava profile'}`);
      onDone?.();
    } catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="stack tight">
        <h2 className="h1" style={{ fontSize: 24 }}>Link your Strava profile</h2>
        <p className="lead">Once only. Then only activities you recorded can be added to your challenges.</p>
      </div>
      <ol className="steps">
        <li><span className="n">1</span><span>In the Strava app, tap <span className="strong">You</span> (bottom right) to open your profile.</span></li>
        <li><span className="n">2</span><span>Tap the <span className="strong">Share</span> icon (top right) → <span className="strong">Copy link</span>.</span></li>
        <li><span className="n">3</span><span>Paste it here.</span></li>
      </ol>
      <div className="field">
        <label htmlFor="spl">Your Strava profile link</label>
        <div className="input-wrap">
          <input id="spl" className="input has-trail" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="https://strava.app.link/…" value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} />
          <button type="button" className="trail-btn" onClick={paste} aria-label="Paste from clipboard"><Icon name="paste" /></button>
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      <Button type="submit" variant="strava" loading={busy} disabled={!url.trim()}>Link profile</Button>
      <p className="legal">Each Strava profile can be linked to one member only. Your Strava profile must be visible to Everyone.</p>
    </form>
  );
}
