import { test, expect, type Page, type Dialog } from '@playwright/test';

// dash-3-2a (charter PR #5 §3 slot 2, inv-layer split per Aurelius R3
// + Cipher's PR #5 §c suggestion): 2 of A2's 5 validation guards land
// in the inv-layer. Guard 3 (client-deletion ref-integrity) has no
// surface — clients have no delete/deactivate UI in the v2.1 codebase
// — and is documented as deferred in the PR body.
//
// Uses navigator.serviceWorker.ready (D1) and font-stub (hermetic).

type DialogScript = Array<{
  expectType: Dialog['type'] extends () => infer R ? R : never;
  /** substring expected in the dialog message; case-insensitive. */
  matches?: string;
  /** for prompt: the response string. for confirm/alert: ignored. */
  reply?: string;
  /** confirm dialogs: true = accept (OK), false = dismiss (Cancel). default true. */
  accept?: boolean;
}>;

/** Drive a sequence of dialogs in order; capture each one's text for assertions. */
function attachDialogScript(page: Page, script: DialogScript): { seen: string[] } {
  const seen: string[] = [];
  let idx = 0;
  page.on('dialog', async (d) => {
    const step = script[idx++];
    seen.push(`${d.type()}: ${d.message()}`);
    if (!step) {
      await d.dismiss().catch(() => {});
      return;
    }
    if (step.matches) {
      const ok = d.message().toLowerCase().includes(step.matches.toLowerCase());
      if (!ok) {
        // Surface the mismatch via the seen[] log — assertions read it.
        seen.push(`!! mismatch at step ${idx - 1}: expected "${step.matches}"`);
      }
    }
    if (d.type() === 'prompt') {
      await d.accept(step.reply ?? '');
    } else if (step.accept === false) {
      await d.dismiss();
    } else {
      await d.accept();
    }
  });
  return { seen };
}

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

test.describe('dash-3-2a inv-layer validation guards @smoke', () => {
  test('Rate-card duplicate guard BLOCKS same-material add for same client', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sep_clients_v1', JSON.stringify([
        { id: 'cli_test', name: 'Test Client', gstin: '20ABCDE1234F1Z5', stateCode: '20', billingPref: 'per dispatch', inactive: false },
      ]));
      localStorage.setItem('sep_rates_v1', JSON.stringify([
        { id: 'r_existing', clientId: 'cli_test', material: 'Hex bolts', unit: 'kg', rate: 10, effectiveFrom: '2026-01-01' },
      ]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    const { seen } = attachDialogScript(page, [
      { expectType: 'prompt', matches: 'rates for', reply: 'add' },
      { expectType: 'prompt', matches: 'material type', reply: 'Hex bolts' },
      { expectType: 'alert', matches: 'already exists' },
    ]);

    const before = await page.evaluate(() => localStorage.getItem('sep_rates_v1'));
    await page.evaluate(() => {
      // @ts-expect-error global
      window.editClientRates('cli_test');
    });
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => localStorage.getItem('sep_rates_v1'));

    expect(seen.find((s) => s.startsWith('alert:') && s.toLowerCase().includes('already exists')), `alert with "already exists" must fire; saw:\n${seen.join('\n')}`).toBeTruthy();
    expect(after, 'rates must be unchanged when duplicate is blocked').toBe(before);
  });

  test('Rate-card duplicate guard ALLOWS new material for same client (happy path)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sep_clients_v1', JSON.stringify([
        { id: 'cli_test', name: 'Test Client', gstin: '20ABCDE1234F1Z5', stateCode: '20', billingPref: 'per dispatch', inactive: false },
      ]));
      localStorage.setItem('sep_rates_v1', JSON.stringify([
        { id: 'r_existing', clientId: 'cli_test', material: 'Hex bolts', unit: 'kg', rate: 10, effectiveFrom: '2026-01-01' },
      ]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    attachDialogScript(page, [
      { expectType: 'prompt', matches: 'rates for', reply: 'add' },
      { expectType: 'prompt', matches: 'material type', reply: 'MS Plates' },
      { expectType: 'prompt', matches: 'unit', reply: 'kg' },
      { expectType: 'prompt', matches: 'rate per', reply: '15' },
    ]);

    await page.evaluate(() => {
      // @ts-expect-error global
      window.editClientRates('cli_test');
    });
    await page.waitForTimeout(200);

    const rates = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_rates_v1') || '[]'));
    expect(rates).toHaveLength(2);
    const newRate = rates.find((r: { material: string }) => r.material === 'MS Plates');
    expect(newRate).toBeTruthy();
    expect(newRate.rate).toBe(15);
    expect(newRate.unit).toBe('kg');
  });

  test('Rate-card duplicate guard is case-insensitive', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sep_clients_v1', JSON.stringify([
        { id: 'cli_test', name: 'Test Client', gstin: '20ABCDE1234F1Z5', stateCode: '20', billingPref: 'per dispatch', inactive: false },
      ]));
      localStorage.setItem('sep_rates_v1', JSON.stringify([
        { id: 'r_existing', clientId: 'cli_test', material: 'Hex Bolts', unit: 'kg', rate: 10, effectiveFrom: '2026-01-01' },
      ]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    const { seen } = attachDialogScript(page, [
      { expectType: 'prompt', matches: 'rates for', reply: 'add' },
      { expectType: 'prompt', matches: 'material type', reply: 'hex bolts' }, // lowercase variant
      { expectType: 'alert', matches: 'already exists' },
    ]);

    await page.evaluate(() => {
      // @ts-expect-error global
      window.editClientRates('cli_test');
    });
    await page.waitForTimeout(150);

    expect(seen.find((s) => s.startsWith('alert:') && s.toLowerCase().includes('already exists')), 'case-insensitive duplicate must trigger the alert').toBeTruthy();
    const rates = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_rates_v1') || '[]'));
    expect(rates, 'rates length unchanged on case-insensitive duplicate').toHaveLength(1);
  });

  test('Duplicate invoice number guard WARNS (and Cancel skips save)', async ({ page }) => {
    // Seed: one client, one existing invoice with invNo SEP/2026-27/0001,
    // and force genInvNumber to produce that same number on the next call.
    await page.evaluate(() => {
      localStorage.setItem('sep_clients_v1', JSON.stringify([
        { id: 'cli_test', name: 'Test Client', gstin: '20ABCDE1234F1Z5', stateCode: '20', billingPref: 'per dispatch', inactive: false },
      ]));
      localStorage.setItem('sep_inv_v1', JSON.stringify([
        {
          id: 'inv_seed', invNo: 'SEP/2026-27/0001', date: '2026-04-01',
          clientId: 'cli_test', clientName: 'Test Client', clientGstin: '20ABCDE1234F1Z5',
          sac: '998871', lineItems: [{ desc: 'Job', unit: 'kg', rate: 10, qty: 5, amount: 50 }],
          taxableValue: 50, cgst: 4, sgst: 4, igst: 0, total: 58,
          supplyType: 'intra', payStatus: 'unpaid', createdAt: '10:00:00',
        },
      ]));
      // Reset nextNumber to 1 so genInvNumber emits SEP/2026-27/0001 again.
      const cfg = JSON.parse(localStorage.getItem('sep_inv_cfg_v1') || '{}');
      cfg.nextNumber = 1;
      cfg.seriesPrefix = cfg.seriesPrefix || 'SEP';
      cfg.stateCode = cfg.stateCode || '20';
      cfg.gstRate = cfg.gstRate || 18;
      cfg.sac = cfg.sac || '998871';
      localStorage.setItem('sep_inv_cfg_v1', JSON.stringify(cfg));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    // First confirm = duplicate-warning ("Save anyway?"). Reply: Cancel.
    const { seen } = attachDialogScript(page, [
      { expectType: 'confirm', matches: 'already exists', accept: false },
    ]);

    const beforeCount = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_v1') || '[]').length);

    // Open the form, fill it, submit. We bypass the modal by directly
    // setting field values + invoking submitInvoiceForm.
    await page.evaluate(() => {
      // @ts-expect-error global
      window.openInvoiceModal();
      (document.getElementById('invFormClient') as HTMLSelectElement).value = 'cli_test';
      (document.getElementById('invFormDate') as HTMLInputElement).value = '2026-04-15';
      // Existing modal already creates one .inv-line-item by default.
      const line = document.querySelector('.inv-line-item');
      if (line) {
        (line.querySelector('.inv-desc') as HTMLInputElement).value = 'Job work';
        (line.querySelector('.inv-qty') as HTMLInputElement).value = '5';
        (line.querySelector('.inv-rate') as HTMLInputElement).value = '10';
      }
      // @ts-expect-error global
      window.submitInvoiceForm();
    });
    await page.waitForTimeout(200);

    expect(seen.find((s) => s.startsWith('confirm:') && s.toLowerCase().includes('already exists')), `duplicate-invoice warning must fire; saw:\n${seen.join('\n')}`).toBeTruthy();
    const afterCount = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_v1') || '[]').length);
    expect(afterCount, 'invoice count unchanged when user cancels duplicate-warning').toBe(beforeCount);
  });

  test('Duplicate invoice number guard does NOT fire on a fresh number (happy path)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('sep_clients_v1', JSON.stringify([
        { id: 'cli_test', name: 'Test Client', gstin: '20ABCDE1234F1Z5', stateCode: '20', billingPref: 'per dispatch', inactive: false },
      ]));
      localStorage.setItem('sep_inv_v1', JSON.stringify([])); // no existing invoices
      const cfg = JSON.parse(localStorage.getItem('sep_inv_cfg_v1') || '{}');
      cfg.nextNumber = 1;
      cfg.seriesPrefix = cfg.seriesPrefix || 'SEP';
      cfg.stateCode = cfg.stateCode || '20';
      cfg.gstRate = cfg.gstRate || 18;
      cfg.sac = cfg.sac || '998871';
      localStorage.setItem('sep_inv_cfg_v1', JSON.stringify(cfg));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    // Only the create-confirm should fire; no duplicate-warning.
    const { seen } = attachDialogScript(page, [
      { expectType: 'confirm', matches: 'create invoice', accept: true },
    ]);

    await page.evaluate(() => {
      // @ts-expect-error global
      window.openInvoiceModal();
      (document.getElementById('invFormClient') as HTMLSelectElement).value = 'cli_test';
      (document.getElementById('invFormDate') as HTMLInputElement).value = '2026-04-15';
      const line = document.querySelector('.inv-line-item');
      if (line) {
        (line.querySelector('.inv-desc') as HTMLInputElement).value = 'Job work';
        (line.querySelector('.inv-qty') as HTMLInputElement).value = '5';
        (line.querySelector('.inv-rate') as HTMLInputElement).value = '10';
      }
      // @ts-expect-error global
      window.submitInvoiceForm();
    });
    await page.waitForTimeout(200);

    // No "already exists" anywhere in the dialog log.
    expect(seen.some((s) => s.toLowerCase().includes('already exists')), `no duplicate warning on fresh number; saw:\n${seen.join('\n')}`).toBe(false);
    const invs = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_v1') || '[]'));
    expect(invs).toHaveLength(1);
    expect(invs[0].invNo).toBe('SEP/2026-27/0001');
  });
});
