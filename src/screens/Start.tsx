import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button, ErrorText } from '../components/Form';
import { GoogleButton } from '../components/GoogleButton';
import { IdentifierFields } from '../components/IdentifierFields';
import { OtpStep } from '../components/OtpStep';
import { auth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { readFlow, saveFlow, useIdentifier } from '../lib/useIdentifier';
import type { Identifier } from '../lib/validation';

/**
 * One screen for sign-up and log-in. Google, or a 6-digit code by email.
 * New members go on to profile setup; returning members land on Today.
 */
export default function Start() {
  const nav = useNavigate();
  const saved = readFlow('signin');
  const [step, setStep] = useState<'id' | 'otp'>(saved ? 'otp' : 'id');
  const [id, setId] = useState<Identifier | null>(saved?.id ?? null);
  const [sentAt, setSentAt] = useState(saved?.sentAt ?? 0);
  const f = useIdentifier(saved?.id);
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (target: Identifier) => {
    await auth.sendOtp(target);
    const t = Date.now();
    setId(target); setSentAt(t);
    // Survives switching to the mail or SMS app and back.
    saveFlow({ flow: 'signin', id: target, step: 'otp', sentAt: t });
  };

  if (step === 'otp' && id) {
    return (
      <Screen back onBack={() => { saveFlow(null); setStep('id'); }}>
        <OtpStep
          id={id}
          sentAt={sentAt}
          onChangeId={() => { saveFlow(null); setStep('id'); }}
          onResend={() => send(id)}
          onVerify={async (code) => {
            await auth.verifyOtp(id, code);
            saveFlow(null);
            nav('/', { replace: true }); // the router sends new members to profile setup
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen back>
      <form
        className="stack loose"
        onSubmit={async (e) => {
          e.preventDefault();
          const target = f.read();
          if (!target) return;
          setBusy(true); setErr(null);
          try { await send(target); setStep('otp'); }
          catch (e2) { setErr(friendlyError(e2)); }
          finally { setBusy(false); }
        }}
      >
        <div className="stack tight">
          <h1 className="h1">Sign in or join</h1>
          <p className="lead">No password needed. We’ll email you a one-time code.</p>
        </div>
        <GoogleButton
          loading={gBusy}
          onClick={async () => {
            setGBusy(true); setErr(null);
            try { await auth.signInWithGoogle(); } catch (e) { setErr(friendlyError(e)); setGBusy(false); }
          }}
        />
        <div className="or">or</div>
        <IdentifierFields f={f} />
        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>Send code</Button>
        <p className="legal">By continuing you agree to share your activity progress with your community’s challenges. Your birthday, mobile number, height and weight always stay private.</p>
      </form>
    </Screen>
  );
}
