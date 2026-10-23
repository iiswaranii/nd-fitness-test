import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button, ErrorText, PasswordField, TextField } from '../components/Form';
import { auth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { normalizeEmail, validateEmail } from '../lib/validation';

/** Returning members: email + password. (Testing phase: no email codes; the admin resets forgotten passwords.) */
export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen back>
      <form className="stack loose" onSubmit={async (e) => {
        e.preventDefault();
        const eErr = validateEmail(email); setEmailErr(eErr);
        if (eErr) return;
        if (!pw) { setErr('Enter your password.'); return; }
        setBusy(true); setErr(null);
        try { await auth.signInWithPassword(normalizeEmail(email), pw); nav('/', { replace: true }); }
        catch (e2) { setErr(friendlyError(e2)); }
        finally { setBusy(false); }
      }}>
        <div className="stack tight">
          <h1 className="h1">Welcome back</h1>
          <p className="lead">Log in with your email and password.</p>
        </div>
        <div className="stack">
          <TextField label="Email address" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErr(null); setErr(null); }} error={emailErr} autoFocus />
          <PasswordField label="Password" autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} />
        </div>
        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>Log in</Button>
        <p className="small muted center-text">Forgot your password? Ask the admin to reset it.</p>
        <p className="small muted center-text">New here? <Link to="/start" replace className="link-btn">Create an account</Link></p>
      </form>
    </Screen>
  );
}
