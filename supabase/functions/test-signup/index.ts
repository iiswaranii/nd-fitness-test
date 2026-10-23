// Testing-phase sign-up: email + password, no email code.
// Creates a confirmed account with that password; the app then logs in normally.
// Switch: works only while app_keys has a 'test_code' row. Delete that row to turn it off.
import { admin, cors, json } from '../_shared/common.ts';

const pwOk = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
    if (!pwOk(password)) return json({ error: 'Your password needs 8+ characters, a letter and a number.' }, 400);

    const db = admin();
    const { data: key } = await db.from('app_keys').select('value').eq('name', 'test_code').maybeSingle();
    if (!key?.value) return json({ error: 'Sign-up is closed right now. Please ask the admin.' }, 403);

    const { data: prof } = await db.from('profiles').select('id, password_set').eq('email', email).maybeSingle();
    if (prof?.password_set) return json({ error: 'An account with this email already exists. Log in instead.' }, 409);

    let uid = prof?.id as string | undefined;
    if (uid) {
      // Started signing up earlier but never set a password: finish it now.
      const { error } = await db.auth.admin.updateUserById(uid, { password, email_confirm: true });
      if (error) throw error;
    } else {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) {
        if (/already/i.test(error.message)) return json({ error: 'An account with this email already exists. Log in instead.' }, 409);
        throw error;
      }
      uid = data.user?.id;
    }
    if (uid) await db.from('profiles').update({ password_set: true }).eq('id', uid);
    return json({ ok: true });
  } catch (e) { console.error(e); return json({ error: 'Couldn’t create the account just now. Please try again.' }, 500); }
});
