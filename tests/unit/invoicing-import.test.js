import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  importInvoicingExport,
  mapBillingUnit, wppGramsFromStdWeight, normalizeUnit,
  customerId, itemId, jobId,
  toJobWithLines,
} from '../../src/shared/import/invoicing-import.js';

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/invoicing-sample.json', import.meta.url)), 'utf8'),
);

const OPTS = { appVersion: 'test', authorUserId: 'u:test', now: '2026-06-10T00:00:00.000Z' };

describe('pure mappers', () => {
  test('billingMode weight→kg, piece→pcs, default→kg', () => {
    expect(mapBillingUnit('weight')).toBe('kg');
    expect(mapBillingUnit('piece')).toBe('pcs');
    expect(mapBillingUnit(undefined)).toBe('kg');
  });

  test('wpp grams = stdWeightKg × 1000; null/0 → null', () => {
    expect(wppGramsFromStdWeight(0.098)).toBe(98);
    expect(wppGramsFromStdWeight(0.102)).toBe(102);
    expect(wppGramsFromStdWeight(null)).toBeNull();
    expect(wppGramsFromStdWeight(0)).toBeNull();
  });

  test('normalizeUnit folds NOS variants', () => {
    expect(normalizeUnit('kg')).toBe('KG');
    expect(normalizeUnit('Nos')).toBe('NOS');
    expect(normalizeUnit('pcs')).toBe('NOS');
  });
});

describe('importInvoicingExport', () => {
  const out = importInvoicingExport(fixture, OPTS);

  test('maps all clients to customers with billing + tier defaults', () => {
    expect(out.customers).toHaveLength(2);
    const acme = out.customers.find((c) => c.id === customerId(1));
    expect(acme.default_billing_unit).toBe('kg');
    expect(acme.client_tier).toBe('default');
    expect(acme.default_quality_tier).toBe('standard');
    expect(acme.sep_invoicing_customer_id).toBe(1);
    expect(acme.deleted_at).toBeNull();
    expect(acme.__schema_version).toBe(2);
  });

  test('inactive client soft-deleted; piece billing → pcs', () => {
    const pw = out.customers.find((c) => c.id === customerId(2));
    expect(pw.default_billing_unit).toBe('pcs');
    expect(pw.deleted_at).toBe(OPTS.now);
  });

  test('items carry part_number, hsn, unit, wpp; method null (not in source)', () => {
    expect(out.items).toHaveLength(3);
    const cd = out.items.find((i) => i.id === itemId(101));
    expect(cd.part_number).toBe('188 CD');
    expect(cd.default_unit).toBe('NOS');
    expect(cd.wpp_grams).toBe(98);
    expect(cd.default_plating_method).toBeNull();
    const clamp = out.items.find((i) => i.id === itemId(102));
    expect(clamp.wpp_grams).toBeNull(); // stdWeightKg null → uncalibrated
  });

  test('challan → 1 job + N job_lines (the load-bearing decision)', () => {
    expect(out.jobs).toHaveLength(2);
    const multi = out.jobs.find((j) => j.id === jobId('2494'));
    const multiLines = out.jobLines.filter((l) => l.job_id === multi.id);
    expect(multiLines).toHaveLength(2);
    // multi-line job has no convenience item_id; single-line job does
    expect(multi.item_id).toBeUndefined();
    const single = out.jobs.find((j) => j.id === jobId('2495'));
    const singleLines = out.jobLines.filter((l) => l.job_id === single.id);
    expect(singleLines).toHaveLength(1);
    expect(single.item_id).toBe(itemId(102));
  });

  test('job rolls up received_kg (sum KG lines) + received_pcs (sum nosQty)', () => {
    const multi = out.jobs.find((j) => j.id === jobId('2494'));
    expect(multi.received_kg).toBeCloseTo(50.2, 3); // 20.2 + 30.0
    expect(multi.received_pcs).toBe(504); // 198 + 306
    expect(multi.customer_id).toBe(customerId(1));
    expect(multi.sep_invoicing_challan_no).toBe('2494');
  });

  test('job_lines resolve item_id by partNumber; carry invoice link', () => {
    const lines = out.jobLines.filter((l) => l.job_id === jobId('2494'));
    const bracket = lines.find((l) => l.part_number === 'BRACKET 5069');
    expect(bracket.item_id).toBe(itemId(100));
    expect(bracket.qty_kg).toBe(20.2);
    expect(bracket.qty_pcs).toBe(198);
    expect(bracket.invoiced).toBe(true);
    expect(bracket.invoice_id).toBe('INV-900');
  });

  test('status: all-lines-invoiced → dispatched, else in-flight', () => {
    // 2494 has one un-invoiced line → in-flight
    expect(out.jobs.find((j) => j.id === jobId('2494')).current_status).toBe('in-flight');
  });

  test('idempotent: re-running yields byte-identical ids', () => {
    const again = importInvoicingExport(fixture, OPTS);
    expect(again.jobs.map((j) => j.id)).toEqual(out.jobs.map((j) => j.id));
    expect(again.jobLines.map((l) => l.id)).toEqual(out.jobLines.map((l) => l.id));
  });

  test('stats summarize the import', () => {
    expect(out.stats).toMatchObject({ customers: 2, items: 3, jobs: 2, jobLines: 3 });
    expect(out.stats.linesResolvedToItem).toBe(3); // all three partNumbers resolve
  });
});

describe('toJobWithLines edge: unresolved partNumber', () => {
  test('leaves item_id undefined when no matching item', () => {
    const im = { challanNo: '9', clientId: 1, items: [{ id: 'x', partNumber: 'UNKNOWN', unit: 'KG', qty: 5 }] };
    const { job, lines } = toJobWithLines(im, new Map(), { audit: {} });
    expect(lines[0].item_id).toBeUndefined();
    expect(job.received_kg).toBe(5);
  });
});
