import { test, expect } from '@playwright/test';

const TABS = [
  { slug: 'home', label: 'Home' },
  { slug: 'attendance', label: 'Attendance' },
  { slug: 'production', label: 'Production' },
  { slug: 'finance', label: 'Finance' },
  { slug: 'invoice', label: 'Invoice' },
  { slug: 'stock', label: 'Stock' },
  { slug: 'history', label: 'History' },
];

// sw.js does `cache.addAll(ASSETS)` on install, where ASSETS includes the
// Google Fonts CSS URL. cache.addAll is all-or-nothing: if the font URL
// fails (sandbox MITM, offline CI, blocked egress), the whole SW install
// rejects and the PWA loses its offline story under test.
//
// Stub the font hosts with 200-empty responses so the suite is hermetic —
// no external network dep, no flakiness from CDN cert chains, SW install
// deterministically succeeds.
test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: '/* stubbed by tests/e2e/smoke.spec.ts */',
    }),
  );
});

test.describe('sep-dashboard baseline smoke @smoke', () => {
  test('1. dashboard renders at /sep-dashboard/ with all 7 tabs visible', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/SEP Dashboard/);
    const tabBar = page.locator('#tabBar');
    await expect(tabBar).toBeVisible();
    for (const { slug, label } of TABS) {
      const btn = page.locator(`.tab-btn[data-tab="${slug}"]`);
      await expect(btn, `tab button for ${slug} must exist`).toBeVisible();
      await expect(btn, `tab button for ${slug} must show label "${label}"`).toHaveText(label);
    }
    await expect(page.locator('.tab-btn.active')).toHaveAttribute('data-tab', 'home');
    await expect(page.locator('#tab-home.active')).toBeVisible();
  });

  test('2. manifest.json loads with correct start_url and display=standalone', async ({ request }) => {
    const res = await request.get('./manifest.json');
    expect(res.status(), 'manifest.json must return 200').toBe(200);
    const body = await res.json();
    expect(body.name).toBe('SEP Dashboard');
    expect(body.short_name).toBe('SEP');
    expect(body.start_url).toBe('/sep-dashboard/');
    expect(body.display).toBe('standalone');
    expect(Array.isArray(body.icons)).toBe(true);
    expect(body.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('3. service worker registers and claims the page', async ({ page }) => {
    await page.goto('./', { waitUntil: 'load' });
    // navigator.serviceWorker.ready resolves to a registration whose
    // .active is non-null, and never rejects — canonical wait pattern
    // for SW activation. See PR #6 review for the race that a polling
    // getRegistration() predicate hits between predicate-passing and
    // the next read.
    const info = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { hasActive: !!r.active, scope: r.scope };
    });
    expect(info.hasActive, 'service worker must be in active state after ready').toBe(true);
    expect(info.scope).toContain('/sep-dashboard/');
  });

  test('4. each tab transition activates its panel without throwing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto('./', { waitUntil: 'domcontentloaded' });
    for (const { slug, label } of TABS) {
      await page.locator(`.tab-btn[data-tab="${slug}"]`).click();
      await expect(
        page.locator(`.tab-btn[data-tab="${slug}"].active`),
        `tab button ${slug} must gain .active after click`,
      ).toHaveCount(1);
      await expect(
        page.locator(`#tab-${slug}.active`),
        `tab panel #tab-${slug} must gain .active after click`,
      ).toBeVisible();
    }
    expect(errors, `no page errors or console errors during tab tour; saw:\n${errors.join('\n')}`).toEqual([]);
  });
});
