import { recordToWrite, PermanentRejection } from '../../src/handler/transport.js';

const CTX = { uid: 'u-handler', build: 1, serverTimestamp: () => '__SERVER_TS__' };

function rec(type, fields, idem = 'idem-1') {
  return { type, idempotencyKey: idem, ts: 1765432100000, fields };
}

describe('recordToWrite() — envelope', () => {
  test('every write carries the rules envelope (author, server ts, numeric-string app_version)', () => {
    const w = recordToWrite(rec('dispatch', { job: 'sep-501' }), CTX);
    expect(w.data.author_user_id).toBe('u-handler');
    expect(w.data.created_at).toBe('__SERVER_TS__');
    expect(w.data.app_version).toBe('1');
    expect(Number.isInteger(Number(w.data.app_version))).toBe(true); // int()-parseable, per buildSupported()
    expect(w.data.idempotency_key).toBe('idem-1');
    expect(w.data.client_ts).toBe(1765432100000);
  });

  test('doc id is the idempotency key', () => {
    const w = recordToWrite(rec('dispatch', { job: 'sep-501' }, 'idem-xyz'), CTX);
    expect(w.path).toEqual(['dispatch_events', 'idem-xyz']);
  });

  test('unknown type and missing uid are rejected', () => {
    expect(() => recordToWrite(rec('bogus', {}), CTX)).toThrow(PermanentRejection);
    expect(() => recordToWrite(rec('dispatch', { job: 'j' }), { serverTimestamp: () => 0 })).toThrow('not-signed-in');
  });
});

describe('production', () => {
  test('VAT machine → qty_pcs; station defaults to plating', () => {
    const w = recordToWrite(rec('production', { job: 'sep-501', machine: 'vat_a1', worker: 'suklal', quantity: '450' }), CTX);
    expect(w.path[0]).toBe('production_entries');
    expect(w.data).toMatchObject({ job_id: 'sep-501', machine_id: 'vat_a1', worker_id: 'suklal', station: 'plating', qty_pcs: 450 });
    expect(w.data.qty_kg).toBeUndefined();
  });

  test('barrel machine → qty_kg', () => {
    const w = recordToWrite(rec('production', { job: 'sep-501', machine: 'barrel', worker: 'birsa', quantity: 32.5 }), CTX);
    expect(w.data.qty_kg).toBe(32.5);
    expect(w.data.qty_pcs).toBeUndefined();
  });

  test('pickling area defaults station to pickling', () => {
    const w = recordToWrite(rec('production', { job: 'sep-501', machine: 'pickle_vat', worker: 'lal', quantity: 100 }), CTX);
    expect(w.data.station).toBe('pickling');
  });

  test("station 'passivation' is a documented rules skew — pre-rejected as permanent", () => {
    expect(() => recordToWrite(
      rec('production', { job: 'j', machine: 'vat_a1', worker: 'w', quantity: 1, station: 'passivation' }), CTX,
    )).toThrow(PermanentRejection);
  });

  test('part picker maps to item_id + part_number label', () => {
    const w = recordToWrite(rec('production', {
      job: 'j', machine: 'vat_a1', worker: 'w', quantity: 1, part: 'item-42', part__label: '188 CD',
    }), CTX);
    expect(w.data.item_id).toBe('item-42');
    expect(w.data.part_number).toBe('188 CD');
  });
});

describe('job_receipt → jobs', () => {
  test('builds a v2 job that satisfies isValidJob', () => {
    const w = recordToWrite(rec('job_receipt', { customer: 'cust-7', weight: '120.5' }), CTX);
    expect(w.path).toEqual(['jobs', 'idem-1']);
    expect(w.data).toMatchObject({
      __schema_version: 2, customer_id: 'cust-7', received_kg: 120.5,
      route: 'standard', current_status: 'in-flight',
    });
  });
});

describe('dft → dft_measurements', () => {
  test('derives outcome from the 8-12 µm benchmark and flags the derivation', () => {
    const pass = recordToWrite(rec('dft', { job: 'j', dft_micron: 10 }), CTX);
    expect(pass.data).toMatchObject({ micron_value: 10, outcome: 'pass', outcome_derived: true });
    const low = recordToWrite(rec('dft', { job: 'j', dft_micron: 5 }), CTX);
    expect(low.data.outcome).toBe('fail-rework');
    const high = recordToWrite(rec('dft', { job: 'j', dft_micron: 14 }), CTX);
    expect(high.data.outcome).toBe('fail-rework');
  });
});

describe('stock forms', () => {
  test('refill with cost + supplier → receipts subcollection with per_kg cost', () => {
    const w = recordToWrite(rec('stock_refill', { item: 'zinc_anodes', supplier: 'sup-1', quantity: 154.13, cost: 270 }), CTX);
    expect(w.path).toEqual(['stock_items', 'zinc_anodes', 'receipts', 'idem-1']);
    expect(w.data).toMatchObject({ qty_received: 154.13, unit_cost: 270, cost_unit: 'per_kg', supplier_id: 'sup-1' });
  });

  test('refill missing cost or supplier is the documented rules skew — permanent', () => {
    expect(() => recordToWrite(rec('stock_refill', { item: 'hcl', quantity: 100 }), CTX)).toThrow(PermanentRejection);
    expect(() => recordToWrite(rec('stock_refill', { item: 'hcl', quantity: 100, cost: 12 }), CTX)).toThrow(PermanentRejection);
  });

  test('depletion defaults reason to production_use', () => {
    const w = recordToWrite(rec('stock_deplete', { item: 'hcl', quantity: 150 }), CTX);
    expect(w.path).toEqual(['stock_items', 'hcl', 'depletions', 'idem-1']);
    expect(w.data).toMatchObject({ qty_depleted: 150, reason: 'production_use' });
  });
});

describe('subcollection + note writes', () => {
  test('machine_state → machines/{mid}/state_transitions', () => {
    const w = recordToWrite(rec('machine_state', { machine: 'vat_a2', state: 'down', notes: 'rectifier' }), CTX);
    expect(w.path).toEqual(['machines', 'vat_a2', 'state_transitions', 'idem-1']);
    expect(w.data).toMatchObject({ state: 'down', notes: 'rectifier' });
  });

  test('check_in → workers/{wid}/shifts', () => {
    const w = recordToWrite(rec('check_in', { worker: 'suklal', direction: 'in' }), CTX);
    expect(w.path).toEqual(['workers', 'suklal', 'shifts', 'idem-1']);
    expect(w.data.direction).toBe('in');
  });

  test('note uses created_by.uid, 120-char summary, non-empty topic_refs (isValidNote)', () => {
    const long = 'x'.repeat(300);
    const w = recordToWrite(rec('note', { note_kind: 'machine', note_text: long }), CTX);
    expect(w.path).toEqual(['notes', 'idem-1']);
    expect(w.data.created_by).toEqual({ uid: 'u-handler' });
    expect(w.data.summary).toHaveLength(120);
    expect(w.data.body).toHaveLength(300);
    expect(w.data.status).toBe('active');
    expect(w.data.topic_refs).toEqual(['machine']);
  });
});
