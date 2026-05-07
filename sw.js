// SEP Dashboard service worker — Phase 2.0 modular bundle.
// Bumped CACHE_NAME forces re-cache when v2.1 single-file users
// receive the update.

const CACHE_NAME = 'sep-v2.1.0-alpha.1';
const ASSETS = [
  '/sep-dashboard/',
  '/sep-dashboard/index.html',
  '/sep-dashboard/manifest.json',
  '/sep-dashboard/src/css/tokens.css',
  '/sep-dashboard/src/css/base.css',
  '/sep-dashboard/src/css/components.css',
  '/sep-dashboard/src/css/responsive.css',
  '/sep-dashboard/dist/dashboard.js',
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Per-asset best-effort, not cache.addAll (which is all-or-nothing).
    // Lets local assets cache even if Google Fonts is unreachable.
    await Promise.allSettled(ASSETS.map((u) => cache.add(u)));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
