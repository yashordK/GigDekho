/*
 * Self-destructing service worker.
 *
 * The previous version of this file cached every same-origin request
 * cache-first, under a hardcoded CACHE_NAME that never changed, with an
 * activate handler that only deleted caches with a *different* name. So it
 * never invalidated anything: a device that installed it kept serving the
 * assets it had cached, indefinitely, no matter what we deployed.
 *
 * Nothing in the app registers a service worker any more, but a registration
 * survives removal of the code that created it — it keeps running until it is
 * explicitly unregistered. That is why a phone could sit on a months-old build
 * while the same account worked correctly on a desktop that never installed
 * it, and why deploying fixes appeared to change nothing on the phone.
 *
 * This version registers no fetch handler at all, so it intercepts nothing.
 * On activation it empties every cache, unregisters itself, and reloads any
 * open tab so the device picks up the real, current site.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      await self.registration.unregister();

      // Reload open tabs so they stop being controlled by this worker and
      // fetch the current assets instead of whatever was cached.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try {
          await client.navigate(client.url);
        } catch {
          /* some browsers disallow navigate(); the next load picks it up */
        }
      }
    })()
  );
});
