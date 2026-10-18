import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button, ErrorText, PasswordField } from '../components/Form';
import { useToast } from '../components/Toast';
import { auth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { useSession } from '../lib/session';
import { passwordValid } from '../lib/validation';
import { RESET_FLAG } from './Start';

/** Create a password after the first email code, set a new one after "Forgot password", or change it from Profile. */
export default function SetPassword() {
  const nav = useNavigate();
  const toast = useToast();
  const { profile, refreshProfile } = useSession();
  const first = !profile?.password_set;
  const reset = (() => { try { return sessionStorage.getItem(RESET_FLAG) === '1'; } catch { return false; } })();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen back={!first && !reset}>
      <form className="stack loose" style={{ paddingTop: 8 }} onSubmit={async (e) => {
        e.preventDefault();
        if (!passwordValid(pw)) { setErr('Your password needs 8+ characters, a letter and a number.'); return; }
        if (pw !== pw2) { setErr('The two passwords don’t match.'); return; }
        setBusy(true); setErr(null);
        try {
          await auth.setPassword(pw);
          try { sessionStorage.removeItem(RESET_FLAG); } catch { /* ignore */ }
          await refreshProfile();
          toast(first ? 'Password created' : 'Password updated');
          nav(first || reset ? '/' : '/profile', { replace: true });
        } catch (e2) { setErr(friendlyError(e2)); }
        finally { setBusy(false); }
      }}>
        <div className="stack tight">
          <p className="eyebrow">{first ? 'Step 2 of 3' : 'Your account'}</p>
          <h1 className="h1">{first ? 'Create a password' : reset ? 'Choose a new password' : 'Change password'}</h1>
          <p className="lead">{first ? 'Next time, log in with your email and this password. No code needed.' : 'Use it with your email to log in.'}</p>
        </div>
        <div className="stack">
          <PasswordField label="Password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} showRules autoFocus />
          <PasswordField label="Type it again" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(null); }} />
        </div>
        <ErrorText>{err}</ErrorText>
        <Button type="submit" loading={busy}>{first ? 'Continue' : 'Save password'}</Button>
      </form>
    </Screen>
  );
}
