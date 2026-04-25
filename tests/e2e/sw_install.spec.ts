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

    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg && (!!reg.active || !!reg.installing || !!reg.waiting);
    }, null, { timeout: 15_000 });

    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return r ? { hasActive: !!r.active, hasInstalling: !!r.installing, hasWaiting: !!r.waiting, scope: r.scope } : null;
    });
    expect(reg, 'SW registration must exist even when fonts are blocked').not.toBeNull();
    expect(reg!.hasActive || reg!.hasInstalling || reg!.hasWaiting).toBe(true);
    expect(reg!.scope).toContain('/sep-dashboard/');

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
