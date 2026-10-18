import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button, ErrorText } from '../components/Form';
import { IdentifierFields } from '../components/IdentifierFields';
import { OtpStep } from '../components/OtpStep';
import { auth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { readFlow, saveFlow, useIdentifier } from '../lib/useIdentifier';
import type { Identifier } from '../lib/validation';

export const RESET_FLAG = 'ndf-reset-password';

/**
 * Email code screens.
 *  /start              create an account: email → code → create a password → name and location
 *  /start?mode=reset   forgot password:  email → code → new password
 */
export default function Start() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const mode: 'signup' | 'reset' = params.get('mode') === 'reset' ? 'reset' : 'signup';
  const saved = readFlow('signin');
  const [step, setStep] = useState<'id' | 'otp'>(saved ? 'otp' : 'id');
  const [id, setId] = useState<Identifier | null>(saved?.id ?? null);
  const [sentAt, setSentAt] = useState(saved?.sentAt ?? 0);
  const f = useIdentifier(saved?.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (target: Identifier) => {
    await auth.sendOtp(target, mode);
    const t = Date.now();
    setId(target); setSentAt(t);
    // Survives switching to the mail app and back.
    saveFlow({ flow: 'signin', id: target, step: mode, sentAt: t });
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
            const wasReset = (saved?.step ?? mode) === 'reset';
            if (wasReset) { try { sessionStorage.setItem(RESET_FLAG, '1'); } catch { /* ignore */ } }
            await auth.verifyOtp(id, code);
            saveFlow(null);
            nav(wasReset ? '/set-password' : '/', { replace: true }); // new members go on to create a password
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
          <h1 className="h1">{mode === 'reset' ? 'Reset your password' : 'Create your account'}</h1>
          <p className="lead">{mode === 'reset' ? 'We’ll email you a code. Then choose a new password.' : 'We’ll email you a 6-digit code to check it’s you. Then you choose a password.'}</p>
        </div>
        <IdentifierFields f={f} autoFocus />
        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>Send code</Button>
        {mode === 'signup' ? (
          <p className="small muted center-text">Already have an account? <Link to="/login" replace className="link-btn">Log in</Link></p>
        ) : (
          <p className="small muted center-text">Remembered it? <Link to="/login" replace className="link-btn">Log in</Link></p>
        )}
        <p className="legal">By continuing you agree to share your activity progress with your community’s challenges. Your birthday, mobile number, height and weight always stay private.</p>
      </form>
    </Screen>
  );
}
