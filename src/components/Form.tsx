import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Picker } from './Picker';
import { COUNTRIES, passwordChecks, type Country } from '../lib/validation';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'strava' | 'danger' };

export function Button({ loading, variant = 'primary', children, disabled, className = '', ...rest }: BtnProps) {
  return (
    <button
      className={`btn ${variant === 'primary' ? '' : variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ErrorText({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p className="error" id={id} role="alert">
      <Icon name="alert" />
      <span>{children}</span>
    </p>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: ReactNode };

export function TextField({ label, error, hint, id, ...rest }: FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <input id={fid} className="input" aria-invalid={!!error || undefined} aria-describedby={error ? fid + '-err' : undefined} {...rest} />
      {error ? <ErrorText id={fid + '-err'}>{error}</ErrorText> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function PasswordField({
  label, error, showRules, value, ...rest
}: FieldProps & { showRules?: boolean; value: string }) {
  const [show, setShow] = useState(false);
  const fid = useId();
  const checks = passwordChecks(value);
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <div className="input-wrap">
        <input
          id={fid}
          className="input has-trail"
          type={show ? 'text' : 'password'}
          value={value}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={!!error || undefined}
          {...rest}
        />
        <button type="button" className="trail-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </div>
      {showRules ? (
        <div className="rules" aria-live="polite">
          {checks.map((c) => (
            <span key={c.id} className={c.ok ? 'ok' : ''}>
              <Icon name={c.ok ? 'check' : 'chev'} />
              {c.label}
            </span>
          ))}
        </div>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export type IdKind = 'email' | 'phone';

export function KindTabs({ kind, onChange }: { kind: IdKind; onChange: (k: IdKind) => void }) {
  return (
    <div className="seg" role="tablist" aria-label="Use email or mobile number">
      {(['email', 'phone'] as const).map((k) => (
        <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => onChange(k)}>
          {k === 'email' ? 'Email' : 'Mobile number'}
        </button>
      ))}
    </div>
  );
}

export function PhoneInput({
  country, onCountry, value, onChange, error, autoFocus, label = 'Mobile number',
}: {
  country: Country; onCountry: (c: Country) => void; value: string; onChange: (v: string) => void;
  error?: string | null; autoFocus?: boolean; label?: string;
}) {
  const fid = useId();
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <div className="phone-row">
        <div style={{ flex: 'none', width: 112 }}>
          <Picker compact title="Country code" value={country.code} onChange={(code) => onCountry(COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0])}
            options={COUNTRIES.map((c) => ({ value: c.code, label: `${c.code} ${c.dial}`, sub: c.name }))} search />
        </div>
        <input
          id={fid}
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={country.code === 'IN' ? '98765 43210' : 'Mobile number'}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d\s-]/g, ''))}
          aria-invalid={!!error || undefined}
          autoFocus={autoFocus}
          maxLength={16}
        />
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
