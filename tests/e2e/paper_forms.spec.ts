import { test, expect } from '@playwright/test';

// The paper backup forms are a PRINT artifact (ADOPTION_PLAN Week 0 escape
// hatch #1), generated from the live handler registry by
// `pnpm paper:forms`. Nothing else exercises their CSS, and a broken sheet is
// discovered at the photocopier on the morning of Week 1 — so a real browser
// parses them here, and the assertions are the ones a printer cares about.
test.beforeEach(async ({ context }) => {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '/* stubbed */' }),
  );
});

test.describe('paper backup forms @smoke', () => {
  test('nine sheets render, Devanagari-first, with the reconciliation tick', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('./dist/paper-forms.html', { waitUntil: 'domcontentloaded' });

    // One sheet per handler form.
    await expect(page.locator('.sheet')).toHaveCount(9);

    // Devanagari is the primary label, English the secondary — the Phase 7
    // lock. Check a form title and a field label actually made it to the page.
    await expect(page.locator('.t-hi', { hasText: 'प्रोडक्शन' }).first()).toBeVisible();
    await expect(page.locator('.h-hi', { hasText: 'कारीगर' }).first()).toBeVisible();

    // The tick is what end-of-shift reconciliation counts into the Adoption
    // view. Both layouts must carry it.
    await expect(page.locator('.c-tick').first()).toBeVisible();
    await expect(page.locator('.block-tick').first()).toContainText('Entered in app');

    // The screen-only cover must not be printable furniture on a sheet.
    await expect(page.locator('.cover')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('every sheet fits one A4 page — width and height', async ({ page }) => {
    await page.goto('./dist/paper-forms.html', { waitUntil: 'domcontentloaded' });
    // 210mm page − 2×8mm margin = 194mm of printable width. Emulate print so
    // the @page/@media print rules are the ones measured.
    await page.emulateMedia({ media: 'print' });
    await page.setViewportSize({ width: 734, height: 1040 });   // ≈194mm at 96dpi

    const overflow = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('.sheet').forEach((s) => {
        const el = s as HTMLElement;
        // A grid table scrolls on screen but must not exceed the sheet in print.
        if (el.scrollWidth > el.clientWidth + 1) {
          out.push(`${el.querySelector('.sheet-id')?.textContent} ${el.scrollWidth}>${el.clientWidth}`);
        }
      });
      return out;
    });
    expect(overflow).toEqual([]);

    // Height: A4 is 297mm less 2×9mm margins ≈ 1055px at 96dpi. A sheet that
    // outgrows it silently spills a second page, and half a form printed on
    // its own sheet is exactly the thing the laminated set cannot recover from.
    // Font substitution moves these numbers a little between machines, hence
    // the headroom in GRID_ROWS rather than a tight fit.
    const heights = await page.evaluate(() => [...document.querySelectorAll('.sheet')].map((s) => ({
      id: s.querySelector('.sheet-id')?.textContent?.split(' ·')[0] ?? '?',
      h: Math.round(s.getBoundingClientRect().height),
    })));
    expect(heights).toHaveLength(9);
    for (const { id, h } of heights) {
      expect(`${id}:${h <= 1055}`).toBe(`${id}:true`);
    }
  });
});
