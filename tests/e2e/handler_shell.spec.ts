import { test, expect } from '@playwright/test';

// Stage C handler shell. Hermetic font stub (mirrors smoke.spec) so the
// suite has no external network dependency.
test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '/* stub */' }),
  );
});

const HANDLER = './entry/handler/';

test.describe('handler PWA shell @smoke', () => {
  test('home renders all 9 form tiles', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/SEP Handler/);
    const tiles = page.locator('.h-tile');
    await expect(tiles).toHaveCount(9);
  });

  test('primary tap targets clear the 64px gloved-hand floor', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    await page.locator('.h-tile').first().waitFor();
    // The 64px floor applies to data-entry targets: form tiles + the
    // settings gear. (The sync chip is a compact status pill, asserted
    // separately below — it's a glanceable indicator, not a form action.)
    for (const sel of ['.h-tile', '.h-gear']) {
      const els = page.locator(sel);
      const n = await els.count();
      for (let i = 0; i < n; i++) {
        const box = await els.nth(i).boundingBox();
        expect(box, `${sel}[${i}] must be laid out`).not.toBeNull();
        expect(box!.height, `${sel}[${i}] height`).toBeGreaterThanOrEqual(64);
      }
    }
    // Form-screen buttons (submit/cancel/back) also clear the floor.
    await page.locator('.h-tile[data-form="note"]').click();
    for (const sel of ['.h-submit', '.h-cancel', '.h-back']) {
      const box = await page.locator(sel).boundingBox();
      expect(box!.height, `${sel} height`).toBeGreaterThanOrEqual(64);
    }
  });

  test('the sync chip is tappable and shows explicit status copy', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    const chip = page.locator('#h-chip');
    await expect(chip).toBeVisible();
    // Never colour-only: the chip carries text, not just a dot.
    await expect(chip).toContainText(/synced|sent|sync|सेव|भेज/i);
  });

  test('language toggle flips tile labels Hindi ↔ English', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    const prodTile = page.locator('.h-tile[data-form="production"] .h-tile-label');
    await expect(prodTile).toHaveText('प्रोडक्शन');

    await page.locator('#h-gear').click();
    await page.locator('.h-seg#h-lang-seg button[data-lang="en"]').click();
    await expect(prodTile).toHaveText('Production');
  });

  test('a form submits, confirms, and lands in the recent-entries log', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    // Note form: just a kind select + a required text area — no picker needed.
    await page.locator('.h-tile[data-form="note"]').click();
    await expect(page.locator('.h-screen-title')).toBeVisible();

    await page.locator('.h-field[data-key="note_text"] .h-textarea').fill('VAT 1 humming');
    await page.locator('.h-submit').click();

    // Multi-modal confirmation: the visual leg is the toast.
    await expect(page.locator('.h-toast')).toContainText('✓');
    // Returns home with the entry queued.
    const row = page.locator('.h-recent-row');
    await expect(row).toContainText('VAT 1 humming');
    await expect(row).toContainText('नोट'); // form-type label resolves (regression: was "undefined")
    await expect(row).not.toContainText('undefined');
    await expect(row.locator('.h-recent-status')).toContainText('⏳');
  });

  test('required-field validation blocks an empty submit', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    await page.locator('.h-tile[data-form="note"]').click();
    await page.locator('.h-submit').click();
    await expect(page.locator('.h-field[data-key="note_text"].h-invalid')).toBeVisible();
    // Still on the form screen (did not return home).
    await expect(page.locator('.h-screen-title')).toBeVisible();
  });

  test('an unusual quantity raises the σ sanity confirm before submitting', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    // Stock depletion: item picker seeds from real config (DEF_STOCK) so it
    // works offline, and quantity is a sanity-configured numeric field.
    await page.locator('.h-tile[data-form="stock_deplete"]').click();
    await page.locator('.h-field[data-key="item"] .h-chooser').click();
    await page.locator('.h-pcard').first().click();
    // 8000 is above the soft ceiling (5000) but below the hard cap — a
    // "confirm", not a "block": the modal must offer a proceed button.
    await page.locator('.h-field[data-key="quantity"] .h-input').fill('8000');
    await page.locator('.h-submit').click();

    const modal = page.locator('.h-modal-overlay');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/असामान्य|unusual/i);
    await expect(modal).toContainText('8000');

    // Confirming it's correct lets the record through to the queue + toast.
    await modal.locator('button', { hasText: /सही|correct/i }).click();
    await expect(page.locator('.h-toast')).toContainText('✓');
    await expect(page.locator('.h-recent-row').first()).toBeVisible();
  });
  test('reopening a form with remembered picker values renders (TDZ regression)', async ({ page }) => {
    await page.goto(HANDLER, { waitUntil: 'domcontentloaded' });
    // App boot creates the sep-handler/kv store — wait for it before seeding.
    await expect(page.locator('.h-tile[data-form="production"]')).toBeVisible();
    // Seed lastvals the way a prior production submit would (machine + worker
    // are remember:true, config-seeded pickers). Pre-fix, the pre-fill loop
    // invoked the picker setValue closure -> scheduleDraft() before its const
    // declaration: a TDZ ReferenceError aborted renderForm mid-loop and the
    // production form died on every reopen after its first submit.
    await page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('sep-handler');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ machine: 'vat_a1', worker: 'shyam_bera' }, 'lastvals:production');
        tx.oncomplete = () => resolve(null);
        tx.onerror = () => reject(tx.error);
      };
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.h-tile[data-form="production"]').click();
    // The form must fully render: title, the prefilled machine field with its
    // hint, and the submit button (wired after the field loop completes).
    await expect(page.locator('.h-screen-title')).toBeVisible();
    await expect(page.locator('.h-field[data-key="machine"].h-prefilled')).toBeVisible();
    await expect(page.locator('.h-field[data-key="machine"] .h-chooser-val')).toContainText('VAT A1');
    await expect(page.locator('.h-submit')).toBeVisible();
  });
});
