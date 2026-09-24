import { test, expect, type Page } from '@playwright/test';

// Pay rates ship with no figures (this repo is public); they arrive through
// Settings → Import roster. Until they do, every pay surface says so rather than
// pricing silently (Castor C-B1 / Janus J-B1, J-H1). All figures here are invented.

async function openSwReady(page: Page) {
  await page.goto('./', { waitUntil: 'load' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
}

test.beforeEach(async ({ context, page }) => {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '/* stub */' }),
  );
  await openSwReady(page);
});

async function seedCfg(page: Page, cfg: object | null) {
  await page.evaluate((c) => {
    if (c) localStorage.setItem('sep_prod_cfg_v1', JSON.stringify(c));
    else localStorage.removeItem('sep_prod_cfg_v1');
  }, cfg);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
}

test.describe('roster import status @smoke', () => {
  test('a fresh install says no rates are loaded, on Home and on Finance', async ({ page }) => {
    await seedCfg(page, null);
    await expect(page.locator('#homeAlerts [data-roster-alert="none"]')).toHaveCount(1);
    await page.locator('.tab-btn[data-tab="finance"]').click();
    await expect(page.locator('#finRateNote [data-roster-alert="none"]')).toHaveCount(1);
  });

  test('rates held from an older build, never imported, are flagged as possibly out of date', async ({ page }) => {
    await seedCfg(page, { hourRate: 11, permOtBaseRate: 123 });
    await expect(page.locator('#homeAlerts [data-roster-alert="held"]')).toHaveCount(1);
    await page.evaluate(() => (window as any).openSettings());
    await expect(page.locator('[data-roster-status="held"]')).toHaveCount(1);
    await expect(page.locator('.settings-panel')).toContainText('₹11/hr · held, not imported');
  });

  test('an imported rate card clears the warning and states its date', async ({ page }) => {
    await seedCfg(page, { hourRate: 50, permOtBaseRate: 484, snackRate: 25, rosterAsOf: '2026-09-24' });
    await expect(page.locator('#homeAlerts [data-roster-alert]')).toHaveCount(0);
    await page.evaluate(() => (window as any).openSettings());
    await expect(page.locator('[data-roster-status="imported"]')).toContainText('as of 2026-09-24');
  });
});
