const CACHE_NAME = 'gigdekho-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Clear old caches on activation
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept: API calls, Supabase auth, external requests
  const shouldPassthrough =
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/rest/') ||
    url.hostname.includes('supabase.co');

  if (shouldPassthrough) {
    // Do NOT call event.respondWith — let browser handle natively
    return;
  }

  // Cache-first for local static assets only
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});
