import { useEffect, useState } from 'react';
import { OtpInput } from './OtpInput';
import { Button, ErrorText } from './Form';
import { maskIdentifier, type Identifier } from '../lib/validation';
import { OTP_LENGTH, RESEND_SECONDS, TEST_INBOX } from '../lib/config';
import { friendlyError } from '../lib/errors';

/** "Enter the code we sent" step, shared by sign-up and password reset. */
export function OtpStep({
  id, sentAt, onVerify, onResend, onChangeId,
}: {
  id: Identifier; sentAt: number;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onChangeId: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  const verify = async (c = code) => {
    if (c.length !== OTP_LENGTH || busy) return;
    setBusy(true); setErr(null);
    try { await onVerify(c); }
    catch (e) { setErr(friendlyError(e)); setCode(''); }
    finally { setBusy(false); }
  };

  return (
    <form className="stack loose" onSubmit={(e) => { e.preventDefault(); verify(); }}>
      <div className="stack tight">
        <h1 className="h1">Enter the code</h1>
        <p className="lead">
          We sent a {OTP_LENGTH}-digit code to <span className="strong">{maskIdentifier(id)}</span>.
          {TEST_INBOX ? ' Test setup: no email is sent. The owner finds the code in Admin → Test inbox.' : id.kind === 'email' ? ' Check your spam folder if it isn’t there.' : ''}
        </p>
      </div>
      <div className="stack tight">
        <OtpInput value={code} onChange={(v) => { setCode(v); setErr(null); }} onComplete={verify} invalid={!!err} disabled={busy} />
        <ErrorText>{err}</ErrorText>
      </div>
      <Button type="submit" loading={busy} disabled={code.length !== OTP_LENGTH}>Verify</Button>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <button type="button" className="link-btn muted" onClick={onChangeId}>
          Change {id.kind === 'email' ? 'email' : 'number'}
        </button>
        {left > 0 ? (
          <span className="small muted" aria-live="polite">Resend in 0:{String(left).padStart(2, '0')}</span>
        ) : (
          <button
            type="button"
            className="link-btn"
            disabled={resending}
            onClick={async () => {
              setResending(true); setErr(null);
              try { await onResend(); setCode(''); } catch (e) { setErr(friendlyError(e)); } finally { setResending(false); }
            }}
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>
    </form>
  );
}
