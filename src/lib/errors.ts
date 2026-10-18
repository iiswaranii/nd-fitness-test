/** Turns backend errors into short, actionable messages. */
export function friendlyError(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? String(err ?? '');
  const m = raw.toLowerCase();
  if (!navigator.onLine || m.includes('failed to fetch') || m.includes('network'))
    return 'You’re offline. Check your connection and try again.';
  if (m.includes('invalid login credentials'))
    return 'That email and password don’t match. Forgot it? Get a code instead.';
  if (m.includes('token has expired') || m.includes('otp') && m.includes('invalid') || m.includes('invalid token'))
    return 'That code is wrong or has expired. Check it, or ask for a new one.';
  const wait = raw.match(/after (\d+) seconds?/i);
  if (wait) return `Please wait ${wait[1]} seconds before asking for another code.`;
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('signups not allowed') || m.includes('user not found') || m.includes('no account'))
    return 'No account with that email yet. Create an account instead.';
  if (m.includes('already registered') || m.includes('already exists'))
    return 'An account already exists. Log in instead.';
  if (m.includes('unsupported phone provider') || m.includes('phone provider') || m.includes('sms'))
    return 'Mobile number sign-up isn’t switched on yet. Please use email or Google for now.';
  if (m.includes('should be different'))
    return 'Choose a password you haven’t used before.';
  if (m.includes('password')) return raw;
  if (m.includes('popup') || m.includes('provider is not enabled'))
    return 'Google sign-in is coming soon. Please use your email for now.';
  return raw || 'Something went wrong. Please try again.';
}
