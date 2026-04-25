import { test, expect, type Page } from '@playwright/test';
import { attachDialogScript } from './_helpers';

// dash-3-2b (charter PR #5 §3 slot 2, ops-layer split per Aurelius R3
// + Cipher's PR #5 §c suggestion): A2's remaining 2 validation guards.
//
//   Guard 2 — advance > wage warning (UI badge on pay-card rows)
//   Guard 4 — empty-attendance guard at confirmProduction (warn-and-allow)
//
// Uses navigator.serviceWorker.ready (D1) and font-stub (hermetic).
// attachDialogScript imported from ./_helpers per Aurelius's PR #8 blessing.

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

test.describe('dash-3-2b ops-layer validation guards @smoke', () => {
  test('A2 #2: over-advance badge surfaces when CW advance > wage', async ({ page }) => {
    // Seed one CW worker present 1 day this week, with an advance that
    // exceeds the calculated wage. CW hourRate * 8h = ₹330/day; advance ₹500
    // beats that.
    await page.evaluate(() => {
      const today = new Date();
      const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = today.getDay(); // 0=Sun..6=Sat
      const sat = new Date(today);
      sat.setDate(today.getDate() + (6 - day) % 7);
      // attendance keys use underscores (getAttKey: date.replace(/-/g,'_'));
      // advance keys use hyphenated satDate (recordCWAdvance line 2952).
      const attKey = `cw_test_${ymd(today).replace(/-/g, '_')}`;
      const advKey = `cw_test_${ymd(sat)}`;

      localStorage.setItem('sep_cw_emp_v2', JSON.stringify([{ id: 'cw_test', name: 'Over-Adv Test', inactive: false }]));
      localStorage.setItem('sep_cw_att_v2', JSON.stringify({ [attKey]: { status: 'P', time: '10:00:00', otHours: 0 } }));
      // ₹500 advance for this week vs. ~₹330 wage for one day present.
      localStorage.setItem('sep_cw_adv_v1', JSON.stringify({ [advKey]: 500 }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    await expect(page.locator('#tab-finance.active')).toBeVisible();

    // The over-advance badge must surface on the CW card row.
    const badge = page.locator('#finCWCard [data-over-advance]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toContainText('over-advance');

    // The row that contains the badge is also marked.
    await expect(page.locator('#finCWCard [data-over-advance-row]')).toHaveCount(1);
  });

  test('A2 #2: over-advance badge ABSENT when advance <= wage (happy path)', async ({ page }) => {
    await page.evaluate(() => {
      const today = new Date();
      const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = today.getDay();
      const sat = new Date(today);
      sat.setDate(today.getDate() + (6 - day) % 7);
      const attKey = `cw_test_${ymd(today).replace(/-/g, '_')}`;
      const advKey = `cw_test_${ymd(sat)}`;

      localStorage.setItem('sep_cw_emp_v2', JSON.stringify([{ id: 'cw_test', name: 'Normal Adv Test', inactive: false }]));
      localStorage.setItem('sep_cw_att_v2', JSON.stringify({ [attKey]: { status: 'P', time: '10:00:00', otHours: 0 } }));
      // ₹100 advance vs. ~₹330 wage — well under, no warning.
      localStorage.setItem('sep_cw_adv_v1', JSON.stringify({ [advKey]: 100 }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    await expect(page.locator('#tab-finance.active')).toBeVisible();

    // No over-advance badge on the CW card.
    await expect(page.locator('#finCWCard [data-over-advance]')).toHaveCount(0);
    await expect(page.locator('#finCWCard [data-over-advance-row]')).toHaveCount(0);
  });

  // Perm-side coverage gap from PR #9 (caught by Aurelius at PR #10 merge).
  // Mirrors the CW pair above; uses sep_pe_* localStorage keys + the
  // advKey shape `${id}_${year}_${month+1}` from calcPermMonthlyPay line 2840.

  test('A2 #2: over-advance badge surfaces when Perm advance > gross', async ({ page }) => {
    await page.evaluate(() => {
      const today = new Date();
      const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const attKey = `pe_test_${ymd(today).replace(/-/g, '_')}`;
      // Perm advance key shape: `${id}_${year}_${month+1}` (1-indexed month).
      const advKey = `pe_test_${today.getFullYear()}_${today.getMonth() + 1}`;

      // Single perm worker with dailyRate ₹400. One day present → gross = ₹400.
      // Advance ₹1000 well exceeds gross.
      localStorage.setItem('sep_pe_emp_v1', JSON.stringify([
        { id: 'pe_test', name: 'Perm Over-Adv', role: 'Worker', dailyRate: 400, inactive: false },
      ]));
      localStorage.setItem('sep_pe_att_v1', JSON.stringify({ [attKey]: { status: 'P', time: '09:00:00', otHours: 0 } }));
      localStorage.setItem('sep_pe_adv_v1', JSON.stringify({ [advKey]: 1000 }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    await expect(page.locator('#tab-finance.active')).toBeVisible();

    // The over-advance badge must surface on the Perm card row.
    const badge = page.locator('#finPermCard [data-over-advance]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toContainText('over-advance');
    await expect(page.locator('#finPermCard [data-over-advance-row]')).toHaveCount(1);
  });

  test('A2 #2: over-advance badge ABSENT on Perm card when advance <= gross (happy path)', async ({ page }) => {
    await page.evaluate(() => {
      const today = new Date();
      const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const attKey = `pe_test_${ymd(today).replace(/-/g, '_')}`;
      const advKey = `pe_test_${today.getFullYear()}_${today.getMonth() + 1}`;

      localStorage.setItem('sep_pe_emp_v1', JSON.stringify([
        { id: 'pe_test', name: 'Perm Normal Adv', role: 'Worker', dailyRate: 400, inactive: false },
      ]));
      localStorage.setItem('sep_pe_att_v1', JSON.stringify({ [attKey]: { status: 'P', time: '09:00:00', otHours: 0 } }));
      // ₹100 advance vs. ₹400 gross — well under, no warning.
      localStorage.setItem('sep_pe_adv_v1', JSON.stringify({ [advKey]: 100 }));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    await expect(page.locator('#tab-finance.active')).toBeVisible();

    // No over-advance badge on the Perm card.
    await expect(page.locator('#finPermCard [data-over-advance]')).toHaveCount(0);
    await expect(page.locator('#finPermCard [data-over-advance-row]')).toHaveCount(0);
  });

  test('A2 #4: empty-attendance guard WARNS at confirmProduction (Cancel skips save)', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.evaluate((ds) => {
      // Seed prod day with empty present array — bypass the lockProdAtt
      // guard to exercise confirmProduction's defense-in-depth.
      const log: Record<string, unknown> = {};
      log[ds] = {
        attLocked: true,
        present: [], // empty — the trigger
        confirmed: false,
        periods: { morningOT: { active: false }, standard: { active: true, areas: {} }, eveningOT: { active: false } },
        timeline: [],
        totals: {},
      };
      localStorage.setItem('sep_prod_log_v1', JSON.stringify(log));
    }, today);
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    const { seen } = attachDialogScript(page, [
      { expectType: 'confirm', matches: 'no workers are marked present', accept: false },
    ]);

    const before = await page.evaluate(() => localStorage.getItem('sep_prod_log_v1'));
    await page.evaluate(() => {
      // @ts-expect-error global
      window.confirmProduction();
    });
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => localStorage.getItem('sep_prod_log_v1'));

    expect(
      seen.find((s) => s.startsWith('confirm:') && s.toLowerCase().includes('no workers are marked present')),
      `empty-attendance warning must fire; saw:\n${seen.join('\n')}`,
    ).toBeTruthy();

    const beforeProd = JSON.parse(before || '{}')[today];
    const afterProd = JSON.parse(after || '{}')[today];
    expect(afterProd?.confirmed, 'confirmed flag must remain false when user cancels').toBe(beforeProd?.confirmed);
    expect(afterProd?.confirmed).toBe(false);
  });

  test('A2 #4: empty-attendance guard ALLOWS confirm when user accepts override', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.evaluate((ds) => {
      const log: Record<string, unknown> = {};
      log[ds] = {
        attLocked: true,
        present: [],
        confirmed: false,
        periods: { morningOT: { active: false }, standard: { active: true, areas: {} }, eveningOT: { active: false } },
        timeline: [],
        totals: {},
      };
      localStorage.setItem('sep_prod_log_v1', JSON.stringify(log));
    }, today);
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    const { seen } = attachDialogScript(page, [
      { expectType: 'confirm', matches: 'no workers are marked present', accept: true },
    ]);

    await page.evaluate(() => {
      // @ts-expect-error global
      window.confirmProduction();
    });
    await page.waitForTimeout(200);

    expect(seen.find((s) => s.toLowerCase().includes('no workers are marked present'))).toBeTruthy();

    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_prod_log_v1') || '{}'));
    expect(log[today]?.confirmed, 'confirmed flag must flip to true when user accepts the override').toBe(true);
  });

  test('A2 #4: empty-attendance guard does NOT fire when present.length > 0 (happy path)', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.evaluate((ds) => {
      const log: Record<string, unknown> = {};
      log[ds] = {
        attLocked: true,
        present: ['sharat_mahato'], // populated
        confirmed: false,
        periods: { morningOT: { active: false }, standard: { active: true, areas: {} }, eveningOT: { active: false } },
        timeline: [],
        totals: {},
      };
      localStorage.setItem('sep_prod_log_v1', JSON.stringify(log));
    }, today);
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    const { seen } = attachDialogScript(page, []);

    await page.evaluate(() => {
      // @ts-expect-error global
      window.confirmProduction();
    });
    await page.waitForTimeout(200);

    // No "no workers are marked present" prompt on the happy path.
    expect(
      seen.some((s) => s.toLowerCase().includes('no workers are marked present')),
      `empty-attendance prompt must NOT fire on happy path; saw:\n${seen.join('\n')}`,
    ).toBe(false);

    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_prod_log_v1') || '{}'));
    expect(log[today]?.confirmed, 'confirmed flag flips on happy path').toBe(true);
  });
});
