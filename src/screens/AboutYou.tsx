import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button, ErrorText, TextField } from '../components/Form';
import { Icon } from '../components/Icon';
import { BodyFields, DobField, LocationFields, MobileField, mobileFrom, mobileValue, validateBody, validateDob, validateLoc, validateMobile, type Body, type Loc, type Mobile } from '../components/DetailsFields';
import { useToast } from '../components/Toast';
import { auth } from '../lib/auth';
import { data } from '../lib/data';
import { useSession } from '../lib/session';
import { friendlyError } from '../lib/errors';
import { validateName } from '../lib/validation';

/**
 * Profile setup after the first sign-in (code or Google).
 * Required: name, country, state. Optional and private: birthday, height, weight.
 */
export default function AboutYou() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, profile, refreshProfile } = useSession();
  const [name, setName] = useState(profile?.full_name ?? user?.name ?? '');
  const [loc, setLoc] = useState<Loc>({ country: profile?.country ?? 'India', state: profile?.state ?? '', city: profile?.city ?? '' });
  const [more, setMore] = useState(false);
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState<Mobile | null>(null);
  const mob = mobile ?? mobileFrom(null, loc.country);
  const [body, setBody] = useState<Body>({ height_cm: '', weight_kg: '' });
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const save = async () => {
    const nE = validateName(name);
    setNameErr(nE);
    const e1 = validateLoc(loc) ?? (dob ? validateDob(dob) : null) ?? validateMobile(mob) ?? validateBody(body);
    setErr(e1);
    if (nE || e1) return;
    setBusy(true);
    try {
      await auth.updateProfile(user.id, { full_name: name.trim(), country: loc.country, state: loc.state.trim(), city: loc.city.trim() || null });
      if (dob || mobileValue(mob) || body.height_cm || body.weight_kg) {
        await data.saveHealth({
          dob: dob || null,
          mobile: mobileValue(mob),
          height_cm: body.height_cm ? Math.round(parseFloat(body.height_cm)) : null,
          weight_kg: body.weight_kg ? +parseFloat(body.weight_kg).toFixed(1) : null,
        });
      }
      await refreshProfile();
      toast(`Welcome, ${name.trim().split(' ')[0]}!`);
      nav('/', { replace: true });
    } catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <form className="stack loose" style={{ paddingTop: 8 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="stack tight">
          <p className="eyebrow">Step 2 of 2</p>
          <h1 className="h1">Set up your profile</h1>
          <p className="lead">Just your name and where you live. The rest is optional.</p>
        </div>

        <section className="card stack">
          <TextField label="Full name" autoComplete="name" autoCapitalize="words" placeholder="Your name" value={name}
            onChange={(e) => { setName(e.target.value); setNameErr(null); }} error={nameErr} />
          <LocationFields v={loc} onChange={(v) => { setLoc(v); setErr(null); }} />
        </section>

        {more ? (
          <section className="card stack">
            <div className="row" style={{ gap: 10 }}><Icon name="shield" /><h2 className="h2">Private details <span className="small muted" style={{ fontWeight: 600 }}>· optional</span></h2></div>
            <p className="small muted" style={{ marginTop: -6 }}>Only you can see these, not even admins. Your birthday lets you join challenges for your age group.</p>
            <DobField value={dob} onChange={(v) => { setDob(v); setErr(null); }} />
            <MobileField v={mob} onChange={(v) => { setMobile(v); setErr(null); }} />
            <BodyFields v={body} onChange={(v) => { setBody(v); setErr(null); }} />
          </section>
        ) : (
          <button type="button" className="private-row" onClick={() => setMore(true)}>
            <span className="sp" style={{ ['--c' as string]: 'var(--ink-2)', width: 36, height: 36 }}><Icon name="plus" /></span>
            <span className="grow"><span className="strong" style={{ display: 'block' }}>Add birthday, mobile, height & weight</span><span className="small muted">Optional · private · you can add them later</span></span>
          </button>
        )}

        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>Continue</Button>
      </form>
    </Screen>
  );
}
