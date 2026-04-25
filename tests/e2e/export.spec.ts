import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// dash-3-3 (charter PR #5 §3 slot 3): B2 monthly CSV export.
// Three exporters: attendance, payroll, costs. Filenames follow
// SEP_<kind>_<YYYY-MM>.csv. Numeric values use sepRound; dates use
// localDateStr (Build Rules 7-9). Implementation mirrors the proven
// GST CSV export Blob+URL.createObjectURL pattern.
//
// Tests intercept the download via page.waitForEvent('download'), read
// the file from the captured temp path, parse rows, and assert
// structure + presence + key totals.
//
// D1: navigator.serviceWorker.ready for SW wait.

const CURRENT_MONTH = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

async function openSwReady(page: Page) {
  await page.goto('./', { waitUntil: 'load' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
}

/** Parse simple CSV: split on newline, then each row split with quote-aware tokens. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const cells: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let buf = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { buf += '"'; i += 2; continue; }
          if (line[i] === '"') { i++; break; }
          buf += line[i++];
        }
        cells.push(buf);
        if (line[i] === ',') i++;
      } else {
        let buf = '';
        while (i < line.length && line[i] !== ',') buf += line[i++];
        cells.push(buf);
        if (line[i] === ',') i++;
      }
    }
    rows.push(cells);
  }
  return rows;
}

async function captureDownload(page: Page, clickSelector: string): Promise<{ filename: string; rows: string[][] }> {
  const downloadPromise = page.waitForEvent('download');
  await page.locator(clickSelector).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const path = await download.path();
  if (!path) throw new Error(`download path unavailable for ${filename}`);
  const text = readFileSync(path, 'utf8');
  return { filename, rows: parseCSV(text) };
}

test.beforeEach(async ({ context, page }) => {
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '/* stub */' }),
  );
  await openSwReady(page);
});

test.describe('dash-3-3 monthly CSV export @smoke', () => {
  test('Attendance CSV: structure + filename + per-record row', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todayKeyDate = today.replace(/-/g, '_');
    await page.evaluate(({ todayKeyDate }) => {
      localStorage.setItem('sep_cw_emp_v2', JSON.stringify([
        { id: 'cw_alpha', name: 'Alpha CW', inactive: false },
      ]));
      localStorage.setItem('sep_cw_att_v2', JSON.stringify({
        [`cw_alpha_${todayKeyDate}`]: { status: 'P', time: '09:00:00', otHours: 2 },
      }));
    }, { todayKeyDate });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    const { filename, rows } = await captureDownload(page, '[data-export-attendance]');

    expect(filename).toBe(`SEP_attendance_${CURRENT_MONTH}.csv`);
    // Header + at least one data row.
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]).toEqual(['Worker ID', 'Worker Name', 'Type', 'Date', 'Status', 'OT Hours']);
    const alphaRow = rows.find((r) => r[0] === 'cw_alpha');
    expect(alphaRow, `data row for cw_alpha must exist; saw rows: ${JSON.stringify(rows)}`).toBeTruthy();
    expect(alphaRow![1]).toBe('Alpha CW');
    expect(alphaRow![2]).toBe('CW');
    expect(alphaRow![3]).toBe(today);
    expect(alphaRow![4]).toBe('P');
    expect(alphaRow![5]).toBe('2');
  });

  test('Payroll CSV: structure + per-worker aggregate row', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todayKeyDate = today.replace(/-/g, '_');
    await page.evaluate(({ todayKeyDate }) => {
      localStorage.setItem('sep_cw_emp_v2', JSON.stringify([
        { id: 'cw_beta', name: 'Beta CW', inactive: false },
      ]));
      localStorage.setItem('sep_cw_att_v2', JSON.stringify({
        [`cw_beta_${todayKeyDate}`]: { status: 'P', time: '09:00:00', otHours: 0 },
      }));
    }, { todayKeyDate });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    const { filename, rows } = await captureDownload(page, '[data-export-payroll]');

    expect(filename).toBe(`SEP_payroll_${CURRENT_MONTH}.csv`);
    expect(rows[0]).toEqual(['Worker ID', 'Worker Name', 'Type', 'Days', 'Gross', 'OT Hours', 'Advance', 'Net']);
    const betaRow = rows.find((r) => r[0] === 'cw_beta');
    expect(betaRow, `payroll row for cw_beta must exist; saw: ${JSON.stringify(rows)}`).toBeTruthy();
    expect(betaRow![1]).toBe('Beta CW');
    expect(betaRow![2]).toBe('CW');
    expect(betaRow![3]).toBe('1');     // 1 day present
    expect(parseInt(betaRow![4])).toBeGreaterThan(0); // gross > 0
    expect(betaRow![5]).toBe('0');     // 0 OT hours
    expect(betaRow![6]).toBe('0');     // no advance
  });

  test('Costs CSV: structure + per-day total row', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todayKeyDate = today.replace(/-/g, '_');
    await page.evaluate(({ today, todayKeyDate }) => {
      // Seed CW attendance so calcDayWages has data to roll up.
      localStorage.setItem('sep_cw_emp_v2', JSON.stringify([
        { id: 'cw_gamma', name: 'Gamma CW', inactive: false },
      ]));
      localStorage.setItem('sep_cw_att_v2', JSON.stringify({
        [`cw_gamma_${todayKeyDate}`]: { status: 'P', time: '09:00:00', otHours: 0 },
      }));
      // Seed prod day with extra + snack costs so the costs CSV captures them.
      localStorage.setItem('sep_prod_log_v1', JSON.stringify({
        [today]: {
          attLocked: true,
          present: ['cw_gamma'],
          confirmed: true,
          periods: { morningOT: { active: false }, standard: { active: true, areas: {} }, eveningOT: { active: false } },
          timeline: [],
          totals: { extraCost: 200, snackCost: 100 },
        },
      }));
    }, { today, todayKeyDate });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    const { filename, rows } = await captureDownload(page, '[data-export-costs]');

    expect(filename).toBe(`SEP_costs_${CURRENT_MONTH}.csv`);
    expect(rows[0]).toEqual(['Date', 'Day Wages', 'Extra Cost', 'Snack Cost', 'OT Cost', 'Total']);
    const todayRow = rows.find((r) => r[0] === today);
    expect(todayRow, `cost row for ${today} must exist; saw: ${JSON.stringify(rows)}`).toBeTruthy();
    expect(parseInt(todayRow![1])).toBeGreaterThan(0); // day wages > 0
    expect(todayRow![2]).toBe('200');
    expect(todayRow![3]).toBe('100');
    expect(todayRow![4]).toBe('0');
    // total = wages + extra + snack + ot
    const total = parseInt(todayRow![5]);
    const sum = parseInt(todayRow![1]) + 200 + 100 + 0;
    expect(total).toBe(sum);
  });

  test('Empty-state: alert shown when no data in month', async ({ page }) => {
    // Wipe all attendance/prod data so all three exports have nothing to emit.
    await page.evaluate(() => {
      localStorage.setItem('sep_cw_emp_v2', JSON.stringify([]));
      localStorage.setItem('sep_pe_emp_v1', JSON.stringify([]));
      localStorage.setItem('sep_cw_att_v2', JSON.stringify({}));
      localStorage.setItem('sep_pe_att_v1', JSON.stringify({}));
      localStorage.setItem('sep_prod_log_v1', JSON.stringify({}));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    const seen: string[] = [];
    page.on('dialog', async (d) => {
      seen.push(d.message());
      await d.accept();
    });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    await page.locator('[data-export-attendance]').click();
    await page.waitForTimeout(150);
    await page.locator('[data-export-payroll]').click();
    await page.waitForTimeout(150);
    await page.locator('[data-export-costs]').click();
    await page.waitForTimeout(150);

    // Each empty-state alert mentions "No <kind> ... for <month>".
    expect(seen.some((s) => /no attendance recorded for/i.test(s)), `attendance empty alert; saw: ${JSON.stringify(seen)}`).toBe(true);
    expect(seen.some((s) => /no payroll data for/i.test(s)), `payroll empty alert; saw: ${JSON.stringify(seen)}`).toBe(true);
    expect(seen.some((s) => /no cost data for/i.test(s)), `costs empty alert; saw: ${JSON.stringify(seen)}`).toBe(true);
  });

  test('CSV escaping: name with comma + double-quote round-trips correctly', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todayKeyDate = today.replace(/-/g, '_');
    await page.evaluate(({ todayKeyDate }) => {
      localStorage.setItem('sep_cw_emp_v2', JSON.stringify([
        { id: 'cw_quoty', name: 'Worker, "the difficult"', inactive: false },
      ]));
      localStorage.setItem('sep_cw_att_v2', JSON.stringify({
        [`cw_quoty_${todayKeyDate}`]: { status: 'P', time: '09:00:00', otHours: 0 },
      }));
    }, { todayKeyDate });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });

    await page.locator('.tab-btn[data-tab="finance"]').click();
    const { rows } = await captureDownload(page, '[data-export-attendance]');

    const row = rows.find((r) => r[0] === 'cw_quoty');
    expect(row, `quoty row must exist; saw: ${JSON.stringify(rows)}`).toBeTruthy();
    expect(row![1], 'name with comma + quote must round-trip via parser').toBe('Worker, "the difficult"');
  });
});
