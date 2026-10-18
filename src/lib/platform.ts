import { DEMO_AUTH, HASH_ROUTER } from './config';

/** Opened from the Home Screen as an app (not in a browser tab). */
export function isInstalledApp(): boolean {
  return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches)
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export type Device = 'ios' | 'android' | 'desktop';
export function device(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Safari is the browser that can add to the Home Screen most reliably on iPhone. */
export const isIosSafari = () => device() === 'ios' && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(navigator.userAgent);

/**
 * The app is meant to be used installed on a phone. Off in local development and in the demo,
 * or with VITE_REQUIRE_INSTALL=false.
 */
export const REQUIRE_INSTALL: boolean =
  import.meta.env.PROD && !DEMO_AUTH && !HASH_ROUTER && import.meta.env.VITE_REQUIRE_INSTALL !== 'false';

/** Admins may use a computer for exports and insights (VITE_ALLOW_DESKTOP_ADMIN=false turns this off). */
export const ALLOW_DESKTOP_ADMIN: boolean = import.meta.env.VITE_ALLOW_DESKTOP_ADMIN !== 'false';

/* Android/Chrome install prompt: captured as early as possible so the button can show it later. */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((l) => l()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
}
export const canPromptInstall = () => !!deferred;
export function onInstallChange(cb: () => void): () => void { listeners.add(cb); return () => listeners.delete(cb); }
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((l) => l());
  return outcome === 'accepted';
}
