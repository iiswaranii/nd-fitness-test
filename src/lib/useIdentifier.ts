import { useState } from 'react';
import { COUNTRIES, normalizeEmail, toE164, validateEmail, validatePhone, type Country, type Identifier } from './validation';
import type { IdKind } from '../components/Form';

/** Shared state for "email or mobile number" entry. */
export function useIdentifier(initial?: Identifier | null) {
  const [kind, setKind] = useState<IdKind>('email');
  const [email, setEmail] = useState(initial?.kind === 'email' ? initial.email : '');
  const initCountry = initial?.kind === 'phone' ? COUNTRIES.find((c) => initial.phone.startsWith(c.dial)) ?? COUNTRIES[0] : COUNTRIES[0];
  const [country, setCountry] = useState<Country>(initCountry);
  const [phone, setPhone] = useState(initial?.kind === 'phone' ? initial.phone.slice(initCountry.dial.length) : '');
  const [error, setError] = useState<string | null>(null);

  /** Validates and returns the identifier, or sets an error and returns null. */
  const read = (): Identifier | null => {
    const err = kind === 'email' ? validateEmail(email) : validatePhone(country, phone);
    setError(err);
    if (err) return null;
    return kind === 'email' ? { kind, email: normalizeEmail(email) } : { kind, phone: toE164(country, phone) };
  };

  return {
    kind, setKind: (k: IdKind) => { setKind(k); setError(null); },
    email, setEmail: (v: string) => { setEmail(v); setError(null); },
    country, setCountry,
    phone, setPhone: (v: string) => { setPhone(v); setError(null); },
    error, setError, read,
  };
}

/** Survives the user switching to their mail or SMS app (mobile browsers may reload the page). */
const FLOW_KEY = 'ndf-flow';
export type SavedFlow = { flow: 'signin'; id: Identifier; step: string; sentAt: number };
export function saveFlow(f: SavedFlow | null) {
  try { f ? localStorage.setItem(FLOW_KEY, JSON.stringify(f)) : localStorage.removeItem(FLOW_KEY); } catch { /* ignore */ }
}
export function readFlow(flow: SavedFlow['flow']): SavedFlow | null {
  try {
    const f = JSON.parse(localStorage.getItem(FLOW_KEY) || 'null') as SavedFlow | null;
    if (f && f.flow === flow && Date.now() - f.sentAt < 15 * 60 * 1000) return f;
  } catch { /* ignore */ }
  return null;
}
