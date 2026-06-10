import {
  getCache, setCache,
  customerToPickerItem, itemToPickerItem, jobToPickerItem,
  customersToPickerItems, itemsToPickerItems, jobsToPickerItems,
} from '../../src/handler/picker-cache.js';
import { importInvoicingExport } from '../../src/shared/import/invoicing-import.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('in-memory cache', () => {
  test('defaults empty (no placeholders) and isolates kinds', () => {
    expect(getCache('customer')).toEqual([]);
    expect(getCache('part')).toEqual([]);
    setCache('customer', [{ id: 'cust-1', primary: 'X' }]);
    expect(getCache('customer')).toHaveLength(1);
    expect(getCache('part')).toEqual([]); // unaffected
  });

  test('setCache coerces non-arrays to empty', () => {
    setCache('job', null);
    expect(getCache('job')).toEqual([]);
  });
});

describe('schema-doc → picker-item adapters', () => {
  test('customer carries billing sub + quality tier tag', () => {
    expect(customerToPickerItem({ id: 'cust-2', name: 'PIECEWISE', default_billing_unit: 'pcs', default_quality_tier: 'premium' }))
      .toEqual({ id: 'cust-2', primary: 'PIECEWISE', sub: 'pcs', tier: 'P' });
  });
  test('item shows part_number primary + unit method', () => {
    expect(itemToPickerItem({ id: 'item-101', part_number: '188 CD', description: '188 CD', default_unit: 'NOS' }))
      .toMatchObject({ id: 'item-101', primary: '188 CD', method: 'NOS' });
  });
  test('job shows challan + status glyph', () => {
    expect(jobToPickerItem({ id: 'sep-2494', sep_invoicing_challan_no: '2494', customer_id: 'cust-1', current_status: 'in-flight' }))
      .toMatchObject({ id: 'sep-2494', primary: 'Challan 2494', method: '•' });
  });
});

describe('importer → picker bridge (end to end)', () => {
  const fx = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/invoicing-sample.json', import.meta.url)), 'utf8'));
  const out = importInvoicingExport(fx, { now: '2026-06-10T00:00:00.000Z' });

  test('imported docs map cleanly into picker items', () => {
    const custItems = customersToPickerItems(out.customers);
    expect(custItems.map((c) => c.primary)).toContain('ACME WEIGHTWORKS');
    expect(itemsToPickerItems(out.items).map((i) => i.primary)).toContain('188 CD');
    expect(jobsToPickerItems(out.jobs).map((j) => j.primary)).toContain('Challan 2494');
  });
});
