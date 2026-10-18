// Phone notifications.
//  { action: "keys" }          any signed-in member → the app's public push key (to subscribe this phone)
//  { challenge_id }            admin, after publishing → notify members who allow alerts and can see the challenge
import { admin, cors, json, requireUser } from '../_shared/common.ts';
import { sendAll, vapidKeys, type Sub } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await requireUser(req);
    if (!user) return json({ error: 'Please log in again.' }, 401);
    const db = admin();
    const body = await req.json().catch(() => ({}));

    if (body.action === 'keys') return json({ publicKey: (await vapidKeys(db)).publicKey });

    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return json({ error: 'Admins only.' }, 403);
    const { data: c } = await db.from('challenges').select('id, title, description, cancelled').eq('id', body.challenge_id).single();
    if (!c || c.cancelled) return json({ error: 'Challenge not found.' }, 404);

    const { data: aud, error: aErr } = await db.rpc('challenge_audience', { cid: c.id });
    if (aErr) throw aErr;
    const ids = (aud ?? []).map((r: { user_id: string }) => r.user_id).filter((id: string) => id !== user.id);
    if (!ids.length) return json({ sent: 0 });

    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id, tz').in('user_id', ids);
    const sent = await sendAll(db, (subs ?? []) as Sub[], () => ({
      title: 'New challenge: ' + c.title,
      body: c.description || 'A new challenge is open. Tap to have a look and join.',
      url: `c/${c.id}`,            // relative to the app's address
      tag: `new-${c.id}`,
    }));
    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: 'Couldn’t send notifications.' }, 500);
  }
});
