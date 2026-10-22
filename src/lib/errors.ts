/**
 * Turns any error (Supabase, network, browser, our own server) into a short, friendly sentence.
 * Our own server already sends friendly sentences; those pass through. Anything technical is replaced.
 */
const GENERIC = 'Something went wrong. Please try again.';
const OFFLINE = 'Couldn’t reach the app’s server. Check your internet connection and try again.';

export function friendlyError(err: unknown): string {
  const e = err as { message?: string; name?: string; code?: string; status?: number } | null;
  const raw = (e?.message ?? (typeof err === 'string' ? err : '') ?? '').trim();
  const m = raw.toLowerCase();
  const name = (e?.name ?? '').toLowerCase();

  // ---- connection ----
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'You’re offline. Check your internet connection and try again.';
  if (name.includes('functionsfetcherror') || name.includes('functionsrelayerror') || m.includes('failed to send a request')
    || m.includes('failed to fetch') || m.includes('load failed') || m.includes('networkerror') || m.includes('network request failed')
    || m.includes('network error') || m.includes('err_network') || m.includes('connection')) return OFFLINE;
  if (m.includes('timeout') || m.includes('timed out') || m.includes('aborted') || name.includes('aborterror'))
    return 'That took too long. Please try again.';

  // ---- sign-in and codes ----
  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Forgot it? Get a code instead.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. We’ve sent you a code.';
  if (m.includes('token has expired') || (m.includes('otp') && (m.includes('invalid') || m.includes('expired'))) || m.includes('invalid token'))
    return 'That code is wrong or has expired. Check it, or ask for a new one.';
  const wait = raw.match(/after (\d+) seconds?/i);
  if (wait) return `Please wait ${wait[1]} seconds before asking for another code.`;
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) return 'Too many codes were sent just now. Please wait a few minutes and try again.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('signups not allowed') || m.includes('user not found') || m.includes('no account')) return 'No account with that email yet. Create an account instead.';
  if (m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists. Log in instead.';
  if (m.includes('should be different')) return 'Choose a password you haven’t used before.';
  if (m.includes('weak password') || m.includes('password should be') || m.includes('password must')) return 'Please choose a stronger password: at least 8 characters with letters and numbers.';
  if (m.includes('jwt') || m.includes('refresh token') || m.includes('not authenticated') || m.includes('auth session missing') || m.includes('please log in again'))
    return 'Your session has ended. Please log in again.';
  if (m.includes('unsupported phone provider') || m.includes('phone provider') || m.includes('sms')) return 'Please use your email to sign in.';
  if (m.includes('popup') || m.includes('provider is not enabled')) return 'Please use your email to sign in.';
  if (m.includes('error sending') && m.includes('email')) return 'We couldn’t send the email just now. Please try again in a minute.';

  // ---- database ----
  if (m.includes('duplicate key') || m.includes('unique constraint')) return 'That’s already saved.';
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('violates row') || m.includes('not allowed'))
    return 'You can’t do that here. If you think this is wrong, ask the admin.';
  if (m.includes('violates check constraint') || m.includes('invalid input syntax') || m.includes('out of range'))
    return 'Some of the details don’t look right. Please check them and try again.';

  // ---- push notifications ----
  if (m.includes('notification') && (m.includes('denied') || m.includes('permission'))) return 'Notifications are blocked. Allow them for this app in your phone’s Settings.';

  // ---- anything else ----
  const technical = /edge function|non-2xx|status code|pgrst|postgres|sql|relation|column|null value|syntax|typeerror|referenceerror|undefined|is not a function|json|unexpected token|fetch|cors|internal server|\b5\d\d\b|\bat\s+\w+\s*\(|stack/i;
  if (!raw || technical.test(raw)) return GENERIC;
  return raw;
}
