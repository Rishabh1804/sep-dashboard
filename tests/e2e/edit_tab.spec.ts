import { test, expect } from '@playwright/test';

// Stub the font hosts (same hermetic-SW reasoning as smoke.spec.ts).
test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '/* stubbed */' }),
  );
});

// The Edit tab must render an honest state. With no Firebase config / no
// #token sign-in (the e2e environment has neither), it shows the connect or
// not-signed-in card — never a blank panel, never a fake editable table, and
// never a page error. Live edits + inboxes are exercised against the deployed
// staging rules on-device, not in CI (no service-account in the runner).
test.describe('edit tab @smoke', () => {
  test('Edit tab renders an honest state card without page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.locator('.tab-btn[data-tab="edit"]').click();
    await expect(page.locator('#tab-edit.active')).toBeVisible();
    // Either "Connecting…", "No Firebase config…", or "Not signed in." — all
    // carry the .lv-state shell the Live tab uses. Never an empty panel.
    await expect(page.locator('#editRoot .lv-state')).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });
});
