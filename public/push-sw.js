/* Phone notifications for Namdhari Health & Fitness.
   Loaded into the app's service worker. Shows pushes from our server and opens the right screen on tap. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  const title = d.title || 'Namdhari Health & Fitness';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: self.registration.scope + 'icons/icon-192.png',
    badge: self.registration.scope + 'icons/icon-192.png',
    tag: d.tag || undefined,          // same tag replaces an older reminder instead of stacking
    renotify: !!d.tag,
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || self.registration.scope, self.location.origin).href;
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
