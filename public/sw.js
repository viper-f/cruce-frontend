self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

self.addEventListener('push', event => {
  let title = 'Notification';
  let body = '';
  let url = null;
  try {
    const data = event.data.json();
    title = data.title ?? title;
    body  = data.message ?? data.body ?? body;
    url   = data.url ?? null;
  } catch (e) {
    console.error('[sw] push parse error', e);
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
