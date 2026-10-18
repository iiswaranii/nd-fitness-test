import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button, ErrorText } from '../components/Form';
import { useSession } from '../lib/session';

/** Google sends people back here; Supabase finishes the sign-in from the URL. */
export default function AuthCallback() {
  const nav = useNavigate();
  const { ready, user } = useSession();
  const [err, setErr] = useState<string | null>(() => {
    const q = new URLSearchParams(location.search + '&' + location.hash.slice(1));
    return q.get('error_description');
  });

  useEffect(() => { if (ready && user) nav('/', { replace: true }); }, [ready, user, nav]);
  useEffect(() => {
    if (err) return;
    const t = setTimeout(() => setErr('Sign-in didn’t finish. Please try again.'), 12000);
    return () => clearTimeout(t);
  }, [err]);

  return (
    <Screen center>
      <div className="stack loose" style={{ alignItems: 'center', textAlign: 'center' }}>
        {err ? (
          <>
            <h1 className="h1" style={{ fontSize: 24 }}>Couldn’t sign you in</h1>
            <ErrorText>{err}</ErrorText>
            <Button onClick={() => nav('/', { replace: true })}>Back to start</Button>
          </>
        ) : (
          <>
            <span className="spinner" style={{ width: 36, height: 36 }} aria-hidden="true" />
            <h1 className="h1" style={{ fontSize: 24 }}>Signing you in…</h1>
          </>
        )}
      </div>
    </Screen>
  );
}
