// The per-form Zod write-boundary gate (Stage D hardening).
// Each schema mirrors an isValidX predicate in FIRESTORE_RULES.ref.txt, and
// (for dispatch / check-in / machine-state) guards enums the rules leave open.

import { validateWrite } from '../../src/shared/types/handler-writes.js';

// A minimal valid mapped doc per type (the shape transport.recordToWrite emits,
// minus the envelope which passthrough carries).
const OK = {
  production: { job_id: 'sep-1', machine_id: 'vat_a1', worker_id: 'w', station: 'plating', qty_pcs: 450 },
  job_receipt: { customer_id: 'c-1', received_kg: 120, route: 'standard', current_status: 'in-flight' },
  dft: { job_id: 'sep-1', micron_value: 10, outcome: 'pass' },
  dispatch: { job_id: 'sep-1' },
  stock_refill: { qty_received: 25 },
  stock_deplete: { qty_depleted: 5, reason: 'production_use' },
  machine_state: { state: 'down' },
  check_in: { direction: 'in' },
  note: { created_by: { uid: 'u' }, summary: 'VAT 1 humming', body: 'VAT 1 humming', status: 'active', priority: 'normal', topic_refs: ['machine'] },
};

describe('validateWrite — happy path', () => {
  for (const [type, doc] of Object.entries(OK)) {
    test(`${type}: a well-formed doc passes`, () => {
      expect(validateWrite(type, doc)).toEqual({ ok: true });
    });
    test(`${type}: passthrough carries the envelope + derived fields`, () => {
      const withEnvelope = { ...doc, author_user_id: 'u', created_at: {}, app_version: '3', client_ts: 1, idempotency_key: 'i', notes: 'x' };
      expect(validateWrite(type, withEnvelope).ok).toBe(true);
    });
  }

  test('unknown type never slips through the gate', () => {
    expect(validateWrite('mystery', {}).ok).toBe(false);
  });
});

describe('validateWrite — rules-mirrored rejections', () => {
  test('production: neither qty positive is rejected', () => {
    expect(validateWrite('production', { ...OK.production, qty_pcs: 0 }).ok).toBe(false);
  });
  test('production: qty ≥ 100000 (rules cap) is rejected', () => {
    expect(validateWrite('production', { ...OK.production, qty_pcs: 100000 }).ok).toBe(false);
  });
  test('production: station outside the enum is rejected', () => {
    expect(validateWrite('production', { ...OK.production, station: 'passivation' }).ok).toBe(false);
  });
  test('job_receipt: no positive quantity in either unit is rejected', () => {
    expect(validateWrite('job_receipt', { ...OK.job_receipt, received_kg: 0 }).ok).toBe(false);
  });
  test('job_receipt: NOS-only (received_kg 0 + received_pcs > 0) passes', () => {
    expect(validateWrite('job_receipt', { ...OK.job_receipt, received_kg: 0, received_pcs: 1200 }).ok).toBe(true);
  });
  test('dft: micron > 50 is rejected (physical ceiling)', () => {
    expect(validateWrite('dft', { ...OK.dft, micron_value: 51 }).ok).toBe(false);
  });
  test('dft: micron ≤ 0 is rejected', () => {
    expect(validateWrite('dft', { ...OK.dft, micron_value: 0 }).ok).toBe(false);
  });
  test('dft: outcome outside pass/fail-rework is rejected', () => {
    expect(validateWrite('dft', { ...OK.dft, outcome: 'maybe' }).ok).toBe(false);
  });
  test('stock_refill: cost_unit without unit_cost is rejected (ambiguous price)', () => {
    expect(validateWrite('stock_refill', { ...OK.stock_refill, cost_unit: 'per_kg' }).ok).toBe(false);
  });
  test('stock_refill: unit_cost + cost_unit together pass', () => {
    expect(validateWrite('stock_refill', { ...OK.stock_refill, unit_cost: 400, cost_unit: 'per_kg' }).ok).toBe(true);
  });
  test('stock_deplete: reason outside the enum is rejected', () => {
    expect(validateWrite('stock_deplete', { ...OK.stock_deplete, reason: 'vibes' }).ok).toBe(false);
  });
  test('stock_deplete: level_after 0 (NIL stock-take) passes', () => {
    expect(validateWrite('stock_deplete', { ...OK.stock_deplete, level_after: 0 }).ok).toBe(true);
  });
  test('note: empty summary is rejected', () => {
    expect(validateWrite('note', { ...OK.note, summary: '' }).ok).toBe(false);
  });
  test('note: empty topic_refs is rejected', () => {
    expect(validateWrite('note', { ...OK.note, topic_refs: [] }).ok).toBe(false);
  });
});

describe('validateWrite — guards the enums the rules leave open', () => {
  test('dispatch: missing job_id is rejected (rules are silent on content)', () => {
    expect(validateWrite('dispatch', {}).ok).toBe(false);
  });
  test('dispatch: negative weight is rejected', () => {
    expect(validateWrite('dispatch', { ...OK.dispatch, weight_kg: -5 }).ok).toBe(false);
  });
  test('check_in: direction outside in/out is rejected', () => {
    expect(validateWrite('check_in', { direction: 'sideways' }).ok).toBe(false);
  });
  test('check_in: slot outside the OT enum is rejected', () => {
    expect(validateWrite('check_in', { direction: 'in', slot: 'lunch' }).ok).toBe(false);
  });
  test('machine_state: state outside running/idle/down is rejected', () => {
    expect(validateWrite('machine_state', { state: 'exploded' }).ok).toBe(false);
  });
});

describe('validateWrite — the reason string is human + points at the field', () => {
  test('carries the offending path where zod gives one', () => {
    const r = validateWrite('check_in', { direction: 'sideways' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/direction/);
  });
});
