// This worker intentionally removes the old offline cache.
//
// Previous releases cached `/` and `/index.html` indefinitely. After a deploy,
// that HTML could still refer to JavaScript bundles that no longer existed,
// leaving visitors with only the page background. Keep this file as a cleanup
// worker so browsers that still have the old worker installed can recover.
const APP_CACHE_PREFIX = 'house-of-neuro-cache-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(APP_CACHE_PREFIX))
          .map((name) => caches.delete(name))
      );

      await self.registration.unregister();

      // Reload pages that may have been supplied by the old cache. Without
      // this, an already-open blank page would only recover on its next reload.
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    })()
  );
});
