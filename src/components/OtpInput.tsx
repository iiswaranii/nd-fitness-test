import { useEffect, useRef } from 'react';
import { OTP_LENGTH } from '../lib/config';

/**
 * Six boxes that behave like one field: type, paste a whole code, backspace across boxes,
 * and accept iOS/Android one-time-code autofill (which fills the first box with all digits).
 */
export function OtpInput({
  value, onChange, onComplete, invalid, disabled,
}: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; invalid?: boolean; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

  useEffect(() => {
    refs.current[Math.min(value.length, OTP_LENGTH - 1)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android Chrome: read the code straight from the SMS (WebOTP), when available.
  useEffect(() => {
    if (!('OTPCredential' in window)) return;
    const ac = new AbortController();
    (navigator.credentials as unknown as { get: (o: unknown) => Promise<{ code?: string } | null> })
      .get({ otp: { transport: ['sms'] }, signal: ac.signal })
      .then((otp) => {
        const code = otp?.code?.replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (code) { onChange(code); if (code.length === OTP_LENGTH) onComplete?.(code); }
      })
      .catch(() => {});
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFrom = (start: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    const next = (value.slice(0, start) + clean).slice(0, OTP_LENGTH);
    onChange(next);
    const focusAt = Math.min(next.length, OTP_LENGTH - 1);
    refs.current[focusAt]?.focus();
    if (next.length === OTP_LENGTH) onComplete?.(next);
  };

  return (
    <div className="otp" role="group" aria-label={`${OTP_LENGTH}-digit code`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          placeholder=" "
          disabled={disabled}
          value={d}
          maxLength={i === 0 ? OTP_LENGTH : 1}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) { onChange(value.slice(0, i) + value.slice(i + 1)); return; }
            setFrom(i, v.length > 1 && i === 0 ? v : v.slice(-1));
          }}
          onPaste={(e) => { e.preventDefault(); setFrom(i, e.clipboardData.getData('text')); }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) {
              e.preventDefault();
              onChange(value.slice(0, i - 1));
              refs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
