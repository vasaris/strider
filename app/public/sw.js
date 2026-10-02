// Service worker: install + activate only. No fetch handler, no caching, nothing
// intercepts /api/*. Offline support and caching are chat 3.4.b.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
