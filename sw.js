// SEP Dashboard service worker — Phase 2.0 modular bundle.
// Bumped CACHE_NAME forces re-cache when v2.1 single-file users
// receive the update.

// Version notes, in order:
// alpha.2: dist/dashboard.js + shared chunk hashes changed (Track 2 Firebase
//   wiring). Without this bump, installed clients keep the cached old
//   dashboard.js whose imports point at chunk hashes that no longer exist.
// alpha.5: Edit tab added + shared firebase-session.js memoised → dashboard.js
//   + shared chunk hashes changed again.
// alpha.6: handler form hardening (Zod write-boundary + σ sanity net) → app.js
//   (APP_VERSION/BUILD) changed, so both bundles' bytes shift.
// alpha.7: rule-bounds single-sourcing + zod/mini (firebase-boot chunk
//   553->8.9 kB; zod/mini+schemas in a 36 kB chunk shared by both bundles)
//   + unit-keyed sigma baselines + edit gate -> both bundles shift.
// alpha.8: Adoption view (Week-0 rollout KPI) added to the Edit tab →
//   dashboard.js + components.css changed; app.js (BUILD 5) shifts both
//   bundles. dist/paper-forms.html is deliberately NOT cached — it is a
//   print artifact opened once on a desktop, not a PWA asset.
// alpha.9: worker/area/wage config reconciled against the soma-internal codex
//   (roster, rate card) → app.js BUILD 6 and
//   the shared config chunk both shift, so both bundles' bytes move.
// alpha.10: two BM rulings (21 Sep) — one worker's rate, one tier move; config + app.js (BUILD 7) shift.
// alpha.11: perm OT = min(daily, cap) ÷ 8 × 1.1 (BM, 23 Sep),
//   and the rate is no longer floored to whole rupees before multiplying.
// alpha.12: the seeded roster/config is now RECONCILED against the shipped
//   config on every boot (seed-sync.js) — before this, alpha.9–11's rates only
//   reached fresh installs. Also: guards refused in permOtRate, Costs CSV no
//   longer counts OT twice, History wage pill labelled as a recompute.
// alpha.13: two BM rulings (23 Sep) — perm OT totalled per month and floored
//   once; hours recorded as OT on a guard are paid directed work.
// alpha.14: guard pay follows the month (BM, 23 Sep) — day rate = monthly wage
//   ÷ days in the month, hours beyond the shift at day rate ÷ shift hours.
// alpha.15: ÷12 confirmed; the plain monthly model becomes an option for any
//   non-floor staff (payModel 'monthly-plain'), selectable in Settings.
// alpha.16: pay data leaves the public repo — rates arrive through Settings →
//   Import roster (Director's sensitive-data rule, 24 Sep); seed-sync never
//   overwrites them, so an updated device keeps the rates it holds.
// alpha.17: Governor chain on the move — the import stamps the rate card, and
//   rates a device holds but never imported are flagged on every pay surface;
//   days recorded before the import are repriced; a full month pays in full.
const CACHE_NAME = 'sep-v2.1.0-alpha.17';
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
