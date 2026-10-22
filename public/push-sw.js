/* Phone notifications for Namdhari Health & Fitness.
   Loaded into the app's service worker. Shows pushes from our server and opens the right screen on tap. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  const title = d.title || 'Namdhari Health & Fitness';
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || '',
      icon: self.registration.scope + 'icons/icon-192.png',
      badge: self.registration.scope + 'icons/icon-192.png',
      tag: d.tag || undefined,          // same tag replaces an older reminder instead of stacking
      renotify: !!d.tag,
      data: { url: d.url || '' },
    });
    await updateBadge(1);
  })());
});

/* Number on the app icon = notifications the member hasn't opened yet (Badging API:
   iPhone/iPad home-screen apps on iOS 16.4+, Chrome/Edge installed apps). Cleared when the app is opened. */
async function updateBadge(atLeast) {
  try {
    const shown = await self.registration.getNotifications();
    const n = Math.max(shown.length, atLeast || 0);
    if (!self.navigator || !('setAppBadge' in self.navigator)) return;
    if (n > 0) await self.navigator.setAppBadge(n); else await self.navigator.clearAppBadge();
  } catch (e) { /* badges not supported here */ }
}

self.addEventListener('notificationclose', (event) => { event.waitUntil(updateBadge(0)); });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(updateBadge(0));
  // Links are relative to the app's address (it may live in a sub-folder).
  const url = new URL((event.notification.data && event.notification.data.url) || '', self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin)) { await c.focus(); if ('navigate' in c) await c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});

// The browser can rotate the subscription; ask the open app to save the new one next time it starts.
self.addEventListener('pushsubscriptionchange', () => {});
