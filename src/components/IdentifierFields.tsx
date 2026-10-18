import { TextField } from './Form';
import type { useIdentifier } from '../lib/useIdentifier';

/** Sign-in is by email only (works for members in every country, and email codes are free). */
export function IdentifierFields({ f, autoFocus }: { f: ReturnType<typeof useIdentifier>; autoFocus?: boolean }) {
  return (
    <TextField
      label="Email address"
      type="email"
      inputMode="email"
      autoComplete="email"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="you@example.com"
      value={f.email}
      onChange={(e) => f.setEmail(e.target.value)}
      error={f.error}
      autoFocus={autoFocus}
    />
  );
}
