import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button, ErrorText, PasswordField, TextField } from '../components/Form';
import { auth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { normalizeEmail, passwordValid, validateEmail } from '../lib/validation';

export const RESET_FLAG = 'ndf-reset-password';

/**
 * Create an account: email + password, then name and location.
 * Testing phase: no email code. (The code screens come back when real email is switched on.)
 */
export default function Start() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Old "forgot password" links go to log in for now.
  if (params.get('mode') === 'reset') return <Navigate to="/login" replace />;

  return (
    <Screen back>
      <form
        className="stack loose"
        onSubmit={async (e) => {
          e.preventDefault();
          const eErr = validateEmail(email); setEmailErr(eErr);
          if (eErr) return;
          if (!passwordValid(pw)) { setErr('Your password needs 8+ characters, a letter and a number.'); return; }
          if (pw !== pw2) { setErr('The two passwords don’t match.'); return; }
          setBusy(true); setErr(null);
          try { await auth.signUp(normalizeEmail(email), pw); nav('/', { replace: true }); } // next: name and location
          catch (e2) { setErr(friendlyError(e2)); }
          finally { setBusy(false); }
        }}
      >
        <div className="stack tight">
          <p className="eyebrow">Step 1 of 2</p>
          <h1 className="h1">Create your account</h1>
          <p className="lead">Your email and a password. You’ll use them to log in.</p>
        </div>
        <div className="stack">
          <TextField label="Email address" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErr(null); setErr(null); }} error={emailErr} autoFocus />
          <PasswordField label="Password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} showRules />
          <PasswordField label="Type it again" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(null); }} />
        </div>
        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>Create account</Button>
        <p className="small muted center-text">Already have an account? <Link to="/login" replace className="link-btn">Log in</Link></p>
        <p className="legal">By continuing you agree to share your activity progress with your community’s challenges. Your birthday, mobile number, height and weight always stay private.</p>
      </form>
    </Screen>
  );
}
