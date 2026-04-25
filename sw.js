const CACHE_NAME = 'sep-v2.1';
const ASSETS = [
  '/sep-dashboard/',
  '/sep-dashboard/index.html',
  '/sep-dashboard/manifest.json',
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', e => {
  // Per-asset best-effort, not cache.addAll (which is all-or-nothing).
  // If e.g. fonts.googleapis.com is unreachable, the local assets still
  // cache and the PWA keeps its offline story.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(ASSETS.map(u => cache.add(u)));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
