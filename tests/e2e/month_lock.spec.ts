import { test, expect, type Page } from '@playwright/test';

// dash-3-1 (charter PR #5 §3 slot 1): A1 + A4 month-lock enforcement.
// Verifies the four UI surfaces hide their edit affordances and the
// function-level guards block writes when the target month is locked.
//
// Uses navigator.serviceWorker.ready (D1 from PR #6) for the SW wait.
// Stubs Google Fonts hermetically (shared with smoke.spec.ts).

const CURRENT_MONTH = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

async function seedLockedMonth(page: Page) {
  await page.evaluate((month) => {
    localStorage.setItem('sep_month_lock_v1', JSON.stringify({
      [month]: {
        locked: true,
        lockedAt: '2026-04-30',
        summary: {
          permTotal: 100000,
          cwTotal: 50000,
          extraTotal: 1000,
          snackTotal: 200,
          invoiceTotal: 250000,
          presentDays: 220,
          absentDays: 8,
        },
      },
    }));
  }, CURRENT_MONTH);
}

test.beforeEach(async ({ context, page }) => {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '/* stubbed */' }),
  );
  await page.goto('./', { waitUntil: 'load' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await seedLockedMonth(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
});

test.describe('dash-3-1 month-lock enforcement @smoke', () => {
  test('Attendance tab: mark buttons hidden, banner shown', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="attendance"]').click();
    await expect(page.locator('#tab-attendance.active')).toBeVisible();

    await expect(page.locator('[data-attendance-locked-banner]')).toBeVisible();
    await expect(page.locator('[data-attendance-locked-banner]')).toContainText(CURRENT_MONTH);
    await expect(page.locator('[data-attendance-locked-banner]')).toContainText('read-only');

    await expect(page.locator('#tab-attendance .mark-btn')).toHaveCount(0);
    expect(await page.locator('#tab-attendance [data-attendance-locked-status]').count()).toBeGreaterThan(0);
  });

  test('Production tab: data-month-locked attr, locked banner, confirm hidden', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="production"]').click();
    await expect(page.locator('#tab-production.active')).toBeVisible();

    await expect(page.locator('#tab-production')).toHaveAttribute('data-month-locked', 'true');
    await expect(page.locator('[data-prod-locked-banner]')).toBeVisible();
    await expect(page.locator('[data-prod-locked-banner]')).toContainText(CURRENT_MONTH);
    await expect(page.locator('#tab-production button:has-text("Lock Attendance")')).toHaveCount(0);

    const confirmDisplay = await page.locator('#prodConfirmSection').evaluate((el) => getComputedStyle(el).display);
    expect(confirmDisplay).toBe('none');
  });

  test('Finance tab: Mark as Paid + Record Advance hidden, locked badges shown', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="finance"]').click();
    await expect(page.locator('#tab-finance.active')).toBeVisible();

    await expect(page.locator('[data-cw-pay-locked]')).toBeVisible();
    await expect(page.locator('[data-perm-pay-locked]')).toBeVisible();

    await expect(page.locator('#finCWCard button:has-text("Mark as Paid")')).toHaveCount(0);
    await expect(page.locator('#finCWCard button:has-text("Record Advance")')).toHaveCount(0);
    await expect(page.locator('#finPermCard button:has-text("Mark as Paid")')).toHaveCount(0);
    await expect(page.locator('#finPermCard button:has-text("Record Advance")')).toHaveCount(0);
  });

  test('History tab: locked badge + summary card render', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="history"]').click();
    await expect(page.locator('#tab-history.active')).toBeVisible();

    const card = page.locator('[data-history-locked-card]');
    await expect(card).toBeVisible();
    await expect(card).toContainText(CURRENT_MONTH);
    await expect(card).toContainText('Locked');
    await expect(card).toContainText('Month wage cost');
    await expect(card).toContainText('Present-days');
  });

  test('Function guard: markAtt is a no-op when month is locked', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    const before = await page.evaluate(() => localStorage.getItem('sep_cw_att_v2'));

    const result = await page.evaluate(() => {
      const cw = JSON.parse(localStorage.getItem('sep_cw_emp_v2') || '[]');
      const target = cw.find((w: { id: string; inactive?: boolean }) => !w.inactive);
      if (!target) return 'no-cw-worker';
      // @ts-expect-error global
      window.markAtt(target.id, 'cw', 'P');
      return target.id;
    });
    expect(result).not.toBe('no-cw-worker');

    const after = await page.evaluate(() => localStorage.getItem('sep_cw_att_v2'));
    expect(after, 'cw attendance must be unchanged when month is locked').toBe(before);
  });
});
