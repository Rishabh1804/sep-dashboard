// SEP Dashboard service worker — Phase 2.0 modular bundle.
// Bumped CACHE_NAME forces re-cache when v2.1 single-file users
// receive the update.

// alpha.2: dist/dashboard.js + shared chunk hashes changed (Track 2 Firebase
// wiring). Without this bump, installed clients keep the cached old
// dashboard.js whose imports point at chunk hashes that no longer exist.
// alpha.6: handler form hardening (Zod write-boundary + σ sanity net) → app.js
//   (APP_VERSION/BUILD) changed, so both bundles' bytes shift.
// alpha.7: rule-bounds single-sourcing + zod/mini (firebase-boot chunk
//   553->8.9 kB; zod/mini+schemas in a 36 kB chunk shared by both bundles)
//   + unit-keyed sigma baselines + edit gate -> both bundles shift.
// alpha.5: Edit tab added + shared firebase-session.js memoised → dashboard.js
// + shared chunk hashes changed again.
const CACHE_NAME = 'sep-v2.1.0-alpha.8';
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
  // Cache Storage is ORIGIN-global, not SW-scope-bound: the handler PWA's
  // cache (sep-handler-*) lives beside ours and its offline-first entry
  // assets only repopulate on a handler SW re-install. Spare its namespace —
  // deleting it here bricked handler offline support on dual-install devices
  // every time the dashboard cache name bumped.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k !== CACHE_NAME && !k.startsWith('sep-handler-'))
        .map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Cache-first, plus runtime caching for the build's HASHED chunks
  // (dist/chunks/* — immutable by construction, produced by esbuild
  // splitting). The non-hashed dashboard.js stays install-snapshot-only so
  // a CACHE_NAME bump always refreshes it.
  e.respondWith(caches.match(e.request).then((r) => {
    if (r) return r;
    return fetch(e.request).then((resp) => {
      const url = new URL(e.request.url);
      if (resp.ok && e.request.method === 'GET'
          && url.origin === self.location.origin
          && url.pathname.startsWith('/sep-dashboard/dist/chunks/')) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return resp;
    });
  }));
});
