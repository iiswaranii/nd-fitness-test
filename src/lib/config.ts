const env = import.meta.env;

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY ?? '';

/** Demo mode runs the whole flow in the browser with OTP 123456 — on when asked, or when Supabase keys are missing. */
export const DEMO_AUTH: boolean =
  env.VITE_DEMO_AUTH === 'true' || !SUPABASE_URL || !SUPABASE_ANON_KEY;

/** Hosted single-file demo: routes live in the URL hash (#/challenges) instead of the path. */
export const HASH_ROUTER: boolean = env.VITE_HASH_ROUTER === 'true';
/** Test environment: login codes go to the owner's Test inbox instead of email. */
export const TEST_INBOX: boolean = env.VITE_TEST_INBOX === 'true';
/** Test environment: new accounts use this fixed code and no email is sent (password resets still use real codes). */
export const TEST_SIGNUP_CODE: string = env.VITE_TEST_SIGNUP_CODE ?? '';

/** Navigate the whole page to an in-app route, in either routing mode. */
export function goToRoute(path: string): void {
  if (HASH_ROUTER) location.hash = '#' + path;
  else location.assign(import.meta.env.BASE_URL.replace(/\/$/, '') + path);
}

export const DEMO_OTP = '123456';
export const OTP_LENGTH = 6;
export const RESEND_SECONDS = 45;
