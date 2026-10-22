// TEST ENVIRONMENT ONLY. Lets testers create an account with a fixed code instead of an emailed one.
// - Works only while app_keys has a 'test_code' row (delete that row to switch this off instantly).
// - Only for NEW accounts: an email that already has an account with a password is refused, so nobody
//   can take over an existing member's account with the fixed code. Password resets still use real codes.
import { admin, cors, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

    const db = admin();
    const { data: key } = await db.from('app_keys').select('value').eq('name', 'test_code').maybeSingle();
    if (!key?.value) return json({ error: 'Test sign-up is switched off. Please use the code we emailed you.' }, 403);
    if (code !== key.value) return json({ error: 'That code is wrong. Please check it and try again.' }, 400);

    // Existing account?
    const { data: prof } = await db.from('profiles').select('id, password_set').eq('email', email).maybeSingle();
    if (prof?.password_set) return json({ error: 'An account with this email already exists. Log in instead.' }, 409);
    if (!prof) {
      const { error } = await db.auth.admin.createUser({ email, email_confirm: true });
      if (error && !/already/i.test(error.message)) throw error;
    }
    // A one-time sign-in token the app exchanges for a session (no email is sent).
    const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
    if (error) throw error;
    const tokenHash = data?.properties?.hashed_token;
    if (!tokenHash) throw new Error('No token');
    return json({ token_hash: tokenHash });
  } catch (e) {
    console.error(e);
    return json({ error: 'Couldn’t create the account just now. Please try again.' }, 500);
  }
});
