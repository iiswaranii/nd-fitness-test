import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Page';
import { DEMO_AUTH } from '../lib/config';
import { demoEraseAccounts } from '../lib/auth';
import { resetDemoData } from '../lib/data';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText, TextField } from '../components/Form';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { auth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { useSession } from '../lib/session';
import { validateName } from '../lib/validation';
import { data } from '../lib/data';
import { Badges } from '../components/Badges';
import { TrophyRack } from '../components/TrophyRack';
import { NotificationSettings } from '../components/NotificationSettings';
import { BodyFields, DobField, LocationFields, MobileField, mobileFrom, mobileValue, validateBody, validateDob, validateLoc, validateMobile, type Body, type Loc, type Mobile } from '../components/DetailsFields';
import { useStore } from '../lib/store';
import { cmToFtIn } from '../lib/bmi';
import type { Health } from '../lib/types';

export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, profile, refreshProfile } = useSession();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<'details' | null>(null);
  const [dob, setDob] = useState('');
  const [loc, setLoc] = useState<Loc>({ country: '', state: '', city: '' });
  const [health, setHealth] = useState<Health | null>(null);
  const [body, setBody] = useState<Body>({ height_cm: '', weight_kg: '' });
  const [mob, setMob] = useState<Mobile>(mobileFrom(null));
  const [wipe, setWipe] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? user?.name ?? '');
    setCity(profile?.city ?? '');
    setLoc({ country: profile?.country ?? 'India', state: profile?.state ?? '', city: profile?.city ?? '' });
  }, [profile, user]);
  useEffect(() => { data.getHealth().then(setHealth).catch(() => setHealth(null)); }, []);

  const { reload } = useStore();
  if (!user) return null;
  void city;
  const openEdit = () => {
    setErr(null);
    setDob(health?.dob ?? '');
    setMob(mobileFrom(health?.mobile, profile?.country));
    setBody({ height_cm: health?.height_cm ? String(health.height_cm) : '', weight_kg: health?.weight_kg ? String(health.weight_kg) : '' });
    setEditing('details');
  };
  const where = [profile?.city, profile?.state, profile?.country].filter(Boolean).join(', ');
  const ht = health?.height_cm ? cmToFtIn(health.height_cm) : null;
  const contact = user.email ?? '';

  return (
    <Page>
      <div className="stack loose">
        <div className="row" style={{ gap: 14 }}>
          <Avatar name={name || '?'} size={64} />
          <div style={{ minWidth: 0 }}>
            <h1 className="h1" style={{ fontSize: 24, overflowWrap: 'anywhere' }}>{profile?.full_name || 'Your profile'}</h1>
            <p className="small muted" style={{ overflowWrap: 'anywhere' }}>
              {contact}{user.provider === 'google' ? ' · Google account' : ''}{where ? <><br />{where}</> : null}
            </p>
          </div>
        </div>

        <section className="card stack tight">
          <div className="sec-h"><h2 className="h2">Your details</h2><button className="link-btn" onClick={openEdit}>Edit</button></div>
          <div className="kv">
            <div className="wide"><div className="k">Name</div><div className="v">{profile?.full_name || '—'}</div></div>
            <div className="wide"><div className="k">Lives in</div><div className="v">{where || 'Add your location'}</div></div>
          </div>
          <button className="private-row" onClick={openEdit}>
            <span className="sp" style={{ ['--c' as string]: 'var(--ink-2)', width: 36, height: 36 }}><Icon name="shield" /></span>
            <span className="grow"><span className="strong" style={{ display: 'block' }}>Private details</span><span className="small muted">Birthday, mobile, height and weight · only you can see these</span></span>
            <Icon name="chev" />
          </button>
        </section>

        <TrophyRack />
        <Badges />

        <NotificationSettings />

        <div className="stack tight">
          <h2 className="h2">Strava</h2>
          <div className="list">
            <button className="list-row" onClick={() => nav('/activity')}>
              <span className="sp" style={{ ['--c' as string]: 'var(--strava)' }}><Icon name="link" /></span>
              <span className="grow">
                <span className="strong" style={{ display: 'block' }}>{profile?.strava_connected ? (profile.strava_athlete_name ?? 'Your Strava account') : 'Not linked yet'}</span>
                <span className="small muted">{profile?.strava_connected ? 'Only this athlete’s activities can be added. To change it, ask an admin.' : 'Your first activity link sets this'}</span>
              </span>
              <Icon name="chev" />
            </button>
          </div>
        </div>

        {DEMO_AUTH ? (
          <div className="stack tight">
            <h2 className="h2">Test mode</h2>
            <div className="list">
              <button className="list-row" onClick={() => setWipe(true)}>
                <span className="sp" style={{ ['--c' as string]: 'var(--bad)' }}><Icon name="sync" /></span>
                <span className="grow"><span className="strong" style={{ display: 'block', color: 'var(--bad)' }}>Erase everything and start fresh</span><span className="small muted">All accounts, challenges and activities on this phone</span></span>
              </button>
            </div>
          </div>
        ) : null}
        <div className="stack tight">
          <h2 className="h2">Account</h2>
          <div className="list">
            <div className="list-row">
              <span className="sp" style={{ ['--c' as string]: 'var(--ink-2)' }}><Icon name="mail" /></span>
              <span className="grow"><span className="strong" style={{ display: 'block' }}>Email and password</span><span className="small muted">Forgot it? On the log-in screen, get a code by email.</span></span>
            </div>
            <button className="list-row" onClick={() => nav('/set-password')}>
              <span className="sp" style={{ ['--c' as string]: 'var(--ink-2)' }}><Icon name="shield" /></span>
              <span className="grow strong">Change password</span>
              <Icon name="chev" />
            </button>
            <button
              className="list-row"
              onClick={async () => { await auth.signOut(); nav('/', { replace: true }); }}
            >
              <span className="sp" style={{ ['--c' as string]: 'var(--bad)' }}><Icon name="logout" /></span>
              <span className="grow strong" style={{ color: 'var(--bad)' }}>Log out</span>
            </button>
          </div>
        </div>
      </div>

      <Sheet open={wipe} onClose={() => setWipe(false)} label="Erase everything">
        <h2 className="h1" style={{ fontSize: 24 }}>Erase everything?</h2>
        <p className="lead">Every account, challenge, activity and log on this phone will be deleted. The next account to sign up becomes the first account (the owner).</p>
        <div className="stack tight">
          <Button variant="danger" onClick={() => { resetDemoData(); demoEraseAccounts(); location.replace(location.pathname + location.search); }}>Erase everything</Button>
          <Button variant="ghost" onClick={() => setWipe(false)}>Cancel</Button>
        </div>
      </Sheet>

      <Sheet open={editing === 'details'} onClose={() => setEditing(null)} label="Your details">
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          const nE = validateName(name); setNameErr(nE);
          const oE = validateLoc(loc) ?? (dob ? validateDob(dob) : null) ?? validateMobile(mob) ?? validateBody(body); setErr(oE);
          if (nE || oE) return;
          setSaving(true);
          try {
            await auth.updateProfile(user.id, { full_name: name.trim(), country: loc.country, state: loc.state.trim(), city: loc.city.trim() || null });
            await data.saveHealth({ dob: dob || null, mobile: mobileValue(mob), height_cm: body.height_cm ? Math.round(parseFloat(body.height_cm)) : null, weight_kg: body.weight_kg ? +parseFloat(body.weight_kg).toFixed(1) : null });
            setHealth(await data.getHealth());
            await refreshProfile(); await reload(); setEditing(null); toast('Details saved');
          } catch (e2) { setErr(friendlyError(e2)); } finally { setSaving(false); }
        }}>
          <h2 className="h1" style={{ fontSize: 24 }}>Your details</h2>
          <TextField label="Full name" autoComplete="name" autoCapitalize="words" value={name} onChange={(e) => { setName(e.target.value); setNameErr(null); }} error={nameErr} />
          <LocationFields v={loc} onChange={setLoc} />
          <div className="card stack" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
            <div className="row" style={{ gap: 10 }}><Icon name="shield" /><span className="strong">Private details</span></div>
            <p className="small muted" style={{ marginTop: -8 }}>Only you can see these. Admins and other members never do.</p>
            <DobField value={dob} onChange={setDob} />
            <MobileField v={mob} onChange={setMob} />
            <BodyFields v={body} onChange={setBody} />
            {ht ? <p className="small muted">Saved: {ht.ft}′ {ht.inch}″{health?.weight_kg ? ` · ${health.weight_kg} kg` : ''}{health?.updated_at ? ` · updated ${new Date(health.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</p> : null}
          </div>
          <ErrorText>{err}</ErrorText>
          <Button type="submit" loading={saving}>Save</Button>
        </form>
      </Sheet>
    </Page>
  );
}
