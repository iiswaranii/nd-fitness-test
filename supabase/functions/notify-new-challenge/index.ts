// Admin publishes a challenge → phone notification to members who allow new-challenge alerts.
import { admin, cors, json, requireUser } from '../_shared/common.ts';
import { sendAll, type Sub } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: 'Please log in again.' }, 401);
    const db = admin();
    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return json({ error: 'Admins only.' }, 403);

    const { challenge_id } = await req.json().catch(() => ({}));
    const { data: c } = await db.from('challenges').select('id, title, description, cancelled').eq('id', challenge_id).single();
    if (!c || c.cancelled) return json({ error: 'Challenge not found.' }, 404);

    const { data: subs } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id, tz, profiles!inner(notify_new_challenges)')
      .eq('profiles.notify_new_challenges', true);

    const sent = await sendAll(db, (subs ?? []) as unknown as Sub[], () => ({
      title: 'New challenge: ' + c.title,
      body: c.description || 'A new challenge is open. Tap to have a look and join.',
      url: `/c/${c.id}`,
      tag: `new-${c.id}`,
    }));
    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: 'Couldn’t send notifications.' }, 500);
  }
});
