// Handler PWA service worker — scoped to /sep-dashboard/entry/handler/.
//
// Separate from the dashboard SW (different scope, different asset set).
// Offline-first is load-bearing here: the handler must open and queue
// writes with no signal. Best-effort install (Promise.allSettled) so a
// blocked font CDN never tanks registration — same hardening as sw.js.

const CACHE_NAME = 'sep-handler-2.1.0-alpha.1';
const BASE = '/sep-dashboard/';
const ASSETS = [
  BASE + 'entry/handler/',
  BASE + 'entry/handler/index.html',
  BASE + 'public/manifest-handler.json',
  BASE + 'src/css/tokens.css',
  BASE + 'src/css/base.css',
  BASE + 'src/css/components.css',
  BASE + 'src/css/responsive.css',
  BASE + 'src/css/handler.css',
  BASE + 'dist/handler.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(ASSETS.map((u) => cache.add(u)));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('sep-handler-') && k !== CACHE_NAME)
        .map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
