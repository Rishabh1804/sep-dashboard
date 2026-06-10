import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { importInvoicingExport } from '../../src/shared/import/invoicing-import.js';
import {
  validateImportOutput, validateDoc,
  CustomerSchema, JobSchema, HandlerRecordSchema,
} from '../../src/shared/types/schemas.js';

const fx = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/invoicing-sample.json', import.meta.url)), 'utf8'),
);
const out = importInvoicingExport(fx, { appVersion: 'test', authorUserId: 'u:test', now: '2026-06-10T00:00:00.000Z' });

describe('importer output validates against v2 schemas', () => {
  test('every imported doc passes its collection schema', () => {
    const res = validateImportOutput(out);
    expect(res.failures).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.counts).toMatchObject({ customers: 2, items: 3, jobs: 2, jobLines: 3 });
  });
});

describe('schemas reject malformed docs', () => {
  test('customer with bad billing unit fails', () => {
    const bad = { ...out.customers[0], default_billing_unit: 'tonnes' };
    expect(validateDoc('customers', bad).ok).toBe(false);
  });
  test('job missing customer_id fails', () => {
    const { customer_id, ...bad } = out.jobs[0];
    expect(JobSchema.safeParse(bad).success).toBe(false);
  });
  test('item with zero/negative wpp fails (null is allowed)', () => {
    const negative = { ...out.items[0], wpp_grams: -5 };
    expect(validateDoc('items', negative).ok).toBe(false);
    const uncalibrated = { ...out.items[0], wpp_grams: null };
    expect(validateDoc('items', uncalibrated).ok).toBe(true);
  });
  test('unknown collection is reported, not thrown', () => {
    expect(validateDoc('widgets', {}).ok).toBe(false);
  });
  test('extra/derived fields pass (forward-compatible passthrough)', () => {
    expect(CustomerSchema.safeParse({ ...out.customers[0], health_score: 88 }).success).toBe(true);
  });
});

describe('handler write record schema', () => {
  test('a well-formed queued record validates', () => {
    const rec = { type: 'production', idempotencyKey: 'abc', ts: Date.now(), fields: { quantity: 150 } };
    expect(HandlerRecordSchema.safeParse(rec).success).toBe(true);
  });
  test('a record without an idempotency key fails', () => {
    expect(HandlerRecordSchema.safeParse({ type: 'note', ts: Date.now(), fields: {} }).success).toBe(false);
  });
});
