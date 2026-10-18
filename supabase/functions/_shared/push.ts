import webpush from 'npm:web-push@3.6.7';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type Sub = { id: string; endpoint: string; p256dh: string; auth: string; user_id: string; tz: string };
export type Payload = { title: string; body: string; url?: string; tag?: string };

const SUBJECT = 'https://iiswaranii.github.io/nd-fitness-test/';

/** The app's Web Push key pair. Created on first use and stored server-side in app_keys — never typed in by hand. */
export async function vapidKeys(db: SupabaseClient): Promise<{ publicKey: string; privateKey: string }> {
  const read = async () => {
    const { data } = await db.from('app_keys').select('name, value').in('name', ['vapid_public', 'vapid_private']);
    const get = (n: string) => data?.find((r) => r.name === n)?.value as string | undefined;
    return { publicKey: get('vapid_public'), privateKey: get('vapid_private') };
  };
  let k = await read();
  if (!k.publicKey || !k.privateKey) {
    const g = webpush.generateVAPIDKeys();
    await db.from('app_keys').upsert(
      [{ name: 'vapid_public', value: g.publicKey }, { name: 'vapid_private', value: g.privateKey }],
      { onConflict: 'name', ignoreDuplicates: true },
    );
    k = await read();
  }
  return { publicKey: k.publicKey!, privateKey: k.privateKey! };
}

/** Sends one notification to each subscription. Subscriptions the browser has retired are deleted. */
export async function sendAll(db: SupabaseClient, subs: Sub[], payload: (s: Sub) => Payload): Promise<number> {
  const k = await vapidKeys(db);
  webpush.setVapidDetails(SUBJECT, k.publicKey, k.privateKey);
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(subs.slice(i, i + 50).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload(s)), { TTL: 6 * 3600, urgency: 'high' });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else console.error('push failed', code, (e as Error).message);
      }
    }));
  }
  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
  return sent;
}
