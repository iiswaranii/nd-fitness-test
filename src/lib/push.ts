import { data } from './data';
import { DEMO_AUTH, HASH_ROUTER } from './config';

// Demo builds can pin a key; the real app asks the server for its push key (created server-side on first use).
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
const KEY_CACHE = 'ndf-push-key';
let keyPromise: Promise<string> | null = null;
function pushKey(): Promise<string> {
  if (VAPID_PUBLIC || DEMO_AUTH) return Promise.resolve(VAPID_PUBLIC);
  try { const c = localStorage.getItem(KEY_CACHE); if (c) return Promise.resolve(c); } catch { /* ignore */ }
  keyPromise ??= data.pushPublicKey()
    .then((k) => { try { localStorage.setItem(KEY_CACHE, k); } catch { /* ignore */ } return k; })
    .catch(() => { keyPromise = null; return ''; });
  return keyPromise;
}

export type PushState =
  | 'on'            // permission granted and this device is subscribed
  | 'off'           // supported, not turned on yet
  | 'blocked'       // the member said no in the browser; must change it in phone settings
  | 'install-first' // iPhone/iPad: only works after Add to Home Screen
  | 'unsupported'   // this browser can't receive notifications
  | 'soon';         // the app's push keys aren't set up yet

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !HASH_ROUTER;

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSub(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

const DEMO_KEY = 'ndf-demo-push';

export async function pushState(): Promise<PushState> {
  if (DEMO_AUTH && (HASH_ROUTER || !VAPID_PUBLIC)) {
    try { return localStorage.getItem(DEMO_KEY) === 'on' ? 'on' : 'off'; } catch { return 'off'; }
  }
  if (isIOS() && !isStandalone()) return 'install-first';
  if (!canPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'granted' && (await currentSub())) return 'on';
  return (await pushKey()) ? 'off' : 'soon';
}

/** Ask permission, subscribe this device and save it. Must be called from a tap. */
export async function enablePush(): Promise<PushState> {
  if (DEMO_AUTH && (HASH_ROUTER || !VAPID_PUBLIC)) {
    try { localStorage.setItem(DEMO_KEY, 'on'); } catch { /* ignore */ }
    return 'on';
  }
  const s = await pushState();
  if (s === 'install-first' || s === 'unsupported' || s === 'blocked') return s;
  if (!(await pushKey())) return 'soon';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(await pushKey()) as BufferSource }));
  await data.savePushSubscription(sub.toJSON(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
  return 'on';
}

export async function disablePush(): Promise<void> {
  if (DEMO_AUTH && (HASH_ROUTER || !VAPID_PUBLIC)) { try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ } return; }
  const sub = await currentSub();
  if (sub) { await data.removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
}

/** Keep the saved subscription fresh (browsers rotate them). Call when the app opens. */
export async function refreshPushSubscription(): Promise<void> {
  if (DEMO_AUTH || !canPush() || Notification.permission !== 'granted') return;
  const sub = await currentSub();
  if (sub) await data.savePushSubscription(sub.toJSON(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata').catch(() => {});
}

/** A sample notification so members see what reminders look like. */
export async function testNotification(): Promise<'shown' | 'in-app'> {
  const title = 'Time to log your water';
  const body = '1,500 of 3,000 ml so far today. Tap to add a glass.';
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) { await reg.showNotification(title, { body, icon: import.meta.env.BASE_URL + 'icons/icon-192.png', data: { url: import.meta.env.BASE_URL } }); return 'shown'; }
      new Notification(title, { body }); return 'shown';
    }
  } catch { /* fall through */ }
  return 'in-app';
}

/** Every hour of the day, 12 am to 11 pm. */
export const REMINDER_TIMES = [
  { value: '', label: 'Off' },
  ...Array.from({ length: 24 }, (_, h) => ({ value: `${String(h).padStart(2, '0')}:00`, label: `${h % 12 || 12}:00 ${h < 12 ? 'am' : 'pm'}` })),
];
export const reminderLabel = (v: string | null) => REMINDER_TIMES.find((r) => r.value === (v ?? ''))?.label ?? v ?? 'No reminder';
