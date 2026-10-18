import webpush from 'npm:web-push@3.6.7';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { env } from './common.ts';

let ready = false;
function init() {
  if (ready) return;
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  ready = true;
}

export type Sub = { id: string; endpoint: string; p256dh: string; auth: string; user_id: string; tz: string };
export type Payload = { title: string; body: string; url?: string; tag?: string };

/** Sends one notification to each subscription. Subscriptions the browser has retired are deleted. */
export async function sendAll(db: SupabaseClient, subs: Sub[], payload: (s: Sub) => Payload): Promise<number> {
  init();
  let sent = 0;
  const dead: string[] = [];
  // Small batches keep the function well inside its time limit.
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(subs.slice(i, i + 50).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload(s)), { TTL: 6 * 3600 });
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
