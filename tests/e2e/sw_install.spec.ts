import { test, expect } from '@playwright/test';

// Regression guard for the production failure mode Cipher confirmed in
// PR #3 review §2: when fonts.googleapis.com is unreachable, the old
// cache.addAll(ASSETS) install rejected wholesale and the SW never
// registered, leaving the user with zero offline support.
//
// The hardening (Promise.allSettled + per-asset cache.add in sw.js)
// makes the install best-effort. This test BLOCKS the font hosts (not
// stub) and asserts SW still registers + local assets are cached. If
// someone reverts to cache.addAll, this test fails.
//
// Note: this spec deliberately does NOT inherit smoke.spec.ts's
// font-stub beforeEach (each spec file has its own scope). The block
// here is the test's whole point.

test.describe('sep-dashboard SW install hardening @smoke', () => {
  test('SW install survives blocked Google Fonts (Promise.allSettled regression guard)', async ({ context, page }) => {
    let fontBlockedCount = 0;
    await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) => {
      fontBlockedCount++;
      return route.abort();
    });

    await page.goto('./', { waitUntil: 'load' });

    // navigator.serviceWorker.ready is the canonical wait: it returns a
    // promise that resolves to a registration whose .active is non-null,
    // and never rejects. This avoids the race that a getRegistration()
    // poll can hit between predicate-passing and the next read (Cipher
    // caught the original waitForFunction predicate at ~37% flake under
    // load on PR #6 review; even tightening to require .active still
    // races on getRegistration() snapshot timing).
    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { hasActive: !!r.active, scope: r.scope };
    });
    expect(reg.hasActive, 'SW must be in active state after ready').toBe(true);
    expect(reg.scope).toContain('/sep-dashboard/');

    const cached = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      return keys.map((req) => new URL(req.url).pathname + new URL(req.url).search);
    }, 'sep-v2.1');

    const hasIndex = cached.some((u) => u === '/sep-dashboard/' || u === '/sep-dashboard/index.html');
    const hasManifest = cached.some((u) => u === '/sep-dashboard/manifest.json');
    expect(hasIndex, `cache must contain /sep-dashboard/ or /sep-dashboard/index.html; saw: ${JSON.stringify(cached)}`).toBe(true);
    expect(hasManifest, `cache must contain /sep-dashboard/manifest.json; saw: ${JSON.stringify(cached)}`).toBe(true);

    expect(fontBlockedCount, 'route block must have fired at least once (proves fonts were attempted and blocked)').toBeGreaterThan(0);
  });
});
