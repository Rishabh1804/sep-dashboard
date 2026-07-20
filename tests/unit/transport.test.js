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

  test("station 'passivation' is folded into plating — a stale value is still pre-rejected", () => {
    expect(() => recordToWrite(
      rec('production', { job: 'j', machine: 'vat_a1', worker: 'w', quantity: 1, station: 'passivation' }), CTX,
    )).toThrow(PermanentRejection);
  });

  test('rounds × round size derives the quantity when no total is given', () => {
    const w = recordToWrite(rec('production', { job: 'j', machine: 'vat_a1', worker: 'w', rounds: '108', round_size: '18' }), CTX);
    expect(w.data.qty_pcs).toBe(108 * 18);
    expect(w.data.rounds).toBe(108);
    expect(w.data.round_size).toBe(18);
  });

  test('an explicit total wins over rounds × round size; rounds still recorded', () => {
    const w = recordToWrite(rec('production', { job: 'j', machine: 'vat_a1', worker: 'w', quantity: 1900, rounds: 108, round_size: 18 }), CTX);
    expect(w.data.qty_pcs).toBe(1900);
    expect(w.data.rounds).toBe(108);
  });

  test('neither total nor rounds — pre-rejected as permanent', () => {
    expect(() => recordToWrite(rec('production', { job: 'j', machine: 'vat_a1', worker: 'w' }), CTX))
      .toThrow(PermanentRejection);
    expect(() => recordToWrite(rec('production', { job: 'j', machine: 'vat_a1', worker: 'w', rounds: 5 }), CTX))
      .toThrow(PermanentRejection);
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

  test('NOS-only challan: received_kg 0, count in received_pcs, challan_no kept as label', () => {
    const w = recordToWrite(rec('job_receipt', { customer: 'cust-7', received_pcs: '2000', challan_no: ' 506 ' }), CTX);
    expect(w.data.received_kg).toBe(0);
    expect(w.data.received_pcs).toBe(2000);
    expect(w.data.challan_no).toBe('506');
  });
});

describe('dft → dft_measurements', () => {
  test('explicit inspector outcome wins and is not flagged as derived', () => {
    // 7.8 µm can be a pass for a customer who accepts 7+ — judgment is a field.
    const w = recordToWrite(rec('dft', { job: 'j', dft_micron: 7.8, outcome: 'pass' }), CTX);
    expect(w.data.outcome).toBe('pass');
    expect(w.data.outcome_derived).toBeUndefined();
  });

  test('records without an outcome (pre-field builds) fall back to the 8-12 µm derivation, flagged', () => {
    const pass = recordToWrite(rec('dft', { job: 'j', dft_micron: 10 }), CTX);
    expect(pass.data).toMatchObject({ micron_value: 10, outcome: 'pass', outcome_derived: true });
    expect(recordToWrite(rec('dft', { job: 'j', dft_micron: 5 }), CTX).data.outcome).toBe('fail-rework');
    expect(recordToWrite(rec('dft', { job: 'j', dft_micron: 14 }), CTX).data.outcome).toBe('fail-rework');
  });
});

describe('stock forms', () => {
  test('refill with cost + supplier → receipts subcollection with per_kg cost', () => {
    const w = recordToWrite(rec('stock_refill', { item: 'zinc_anodes', supplier: 'sup-1', quantity: 154.13, cost: 270 }), CTX);
    expect(w.path).toEqual(['stock_items', 'zinc_anodes', 'receipts', 'idem-1']);
    expect(w.data).toMatchObject({ qty_received: 154.13, unit_cost: 270, cost_unit: 'per_kg', supplier_id: 'sup-1' });
  });

  test('litre-tracked stock (HCl, brighteners) prices per_liter, not per_kg', () => {
    const w = recordToWrite(rec('stock_refill', { item: 'hcl', supplier: 'sup-aci', quantity: 660, cost: 12 }), CTX);
    expect(w.data.cost_unit).toBe('per_liter');
  });

  test('unpriced refill (Stage D ruling): no cost/supplier fields, no rejection', () => {
    const w = recordToWrite(rec('stock_refill', { item: 'hcl', quantity: 100 }), CTX);
    expect(w.data.qty_received).toBe(100);
    expect(w.data.unit_cost).toBeUndefined();
    expect(w.data.cost_unit).toBeUndefined();
    expect(w.data.supplier_id).toBeUndefined();
  });

  test('cost without unit never ships bare: cost_unit accompanies unit_cost', () => {
    const w = recordToWrite(rec('stock_refill', { item: 'hcl', quantity: 100, cost: 12 }), CTX);
    expect(w.data.unit_cost).toBe(12);
    expect(w.data.cost_unit).toBe('per_liter');
  });

  test('depletion defaults reason to production_use', () => {
    const w = recordToWrite(rec('stock_deplete', { item: 'hcl', quantity: 150 }), CTX);
    expect(w.path).toEqual(['stock_items', 'hcl', 'depletions', 'idem-1']);
    expect(w.data).toMatchObject({ qty_depleted: 150, reason: 'production_use' });
    expect(w.data.level_after).toBeUndefined();
  });

  test('stock-take NIL: explicit reason + level_after 0 survive the mapping', () => {
    const w = recordToWrite(rec('stock_deplete', { item: 'sodium_cyanide', quantity: 5, reason: 'waste', level_after: 0 }), CTX);
    expect(w.data.reason).toBe('waste');
    expect(w.data.level_after).toBe(0);
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
    expect(w.data.slot).toBeUndefined(); // pre-slot builds stay valid
  });

  test('check_in carries the T-CH slot tag when present', () => {
    const w = recordToWrite(rec('check_in', { worker: 'champai', direction: 'in', slot: 'morning_ot' }), CTX);
    expect(w.data.slot).toBe('morning_ot');
  });

  test('note uses created_by.uid, 120-char summary, non-empty topic_refs (isValidNote)', () => {
    const long = 'x'.repeat(300);
    const w = recordToWrite(rec('note', { note_kind: 'machine', note_text: long }), CTX);
    expect(w.path).toEqual(['notes', 'idem-1']);
    expect(w.data.created_by).toEqual({ uid: 'u-handler' });
    expect(w.data.summary).toHaveLength(120);
    expect(w.data.body).toHaveLength(300);
    expect(w.data.status).toBe('active');
    expect(w.data.priority).toBe('normal');
    expect(w.data.topic_refs).toEqual(['machine']);
  });

  test('power-cut note carries kind + urgent priority (codex power-cut-log evidence)', () => {
    const w = recordToWrite(rec('note', { note_kind: 'power_cut', note_text: 'cut #32 16:00', priority: 'urgent' }), CTX);
    expect(w.data.kind).toBe('power_cut');
    expect(w.data.priority).toBe('urgent');
    expect(w.data.topic_refs).toEqual(['power_cut']);
  });
});

// --- Zod write-boundary gate (Stage D hardening) ---------------------------
// recordToWrite validates the MAPPED doc against its form-type schema and
// raises PermanentRejection on failure. These cases bypass the DOM validate
// (a queued record replayed by a newer build, or a programmatic write): the
// gate is the last deterministic line before Firestore, and the only content
// guard for the enums the rules leave open (dispatch / check-in / machine).
describe('recordToWrite() — Zod gate', () => {
  test('check-in with a bad direction is a PermanentRejection (rules silent on it)', () => {
    expect(() => recordToWrite(rec('check_in', { worker: 'w', direction: 'sideways' }), CTX))
      .toThrow(PermanentRejection);
  });

  test('check-in with a bad OT slot is rejected', () => {
    expect(() => recordToWrite(rec('check_in', { worker: 'w', direction: 'in', slot: 'lunch' }), CTX))
      .toThrow(/schema: slot/);
  });

  test('a well-formed check-in still passes the gate', () => {
    const w = recordToWrite(rec('check_in', { worker: 'w', direction: 'in', slot: 'morning_ot' }), CTX);
    expect(w.path).toEqual(['workers', 'w', 'shifts', 'idem-1']);
    expect(w.data.direction).toBe('in');
    expect(w.data.slot).toBe('morning_ot');
  });

  test('machine-state with a bad state enum is rejected', () => {
    expect(() => recordToWrite(rec('machine_state', { machine: 'vat_a1', state: 'exploded' }), CTX))
      .toThrow(PermanentRejection);
  });

  test('dispatch with a negative weight is rejected', () => {
    expect(() => recordToWrite(rec('dispatch', { job: 'sep-1', weight: -5 }), CTX))
      .toThrow(PermanentRejection);
  });

  test('a DFT replay with an out-of-range micron is caught at the gate', () => {
    // Bypasses the form-level dftRange check (queued by an older build).
    expect(() => recordToWrite(rec('dft', { job: 'sep-1', dft_micron: 999, outcome: 'pass' }), CTX))
      .toThrow(/schema: micron_value/);
  });

  test('an empty-body note is rejected (isValidNote summary > 0)', () => {
    expect(() => recordToWrite(rec('note', { note_kind: 'machine', note_text: '   ' }), CTX))
      .toThrow(PermanentRejection);
  });
});

describe('path-segment guard (review-pass regression)', () => {
  // The data schemas never see picker fields that live only in the doc PATH
  // (worker / item / machine). A missing one must be a PermanentRejection —
  // otherwise fs.doc(db, ...path) throws an SDK error the flush loop
  // classifies as transient, wedging the queue behind the poisoned record.
  test('check_in without worker is permanently rejected, not queued forever', () => {
    expect(() => recordToWrite(rec('check_in', { direction: 'in', slot: 'regular' }), CTX))
      .toThrow(PermanentRejection);
    expect(() => recordToWrite(rec('check_in', { direction: 'in', slot: 'regular' }), CTX))
      .toThrow(/path/);
  });
  test('stock_deplete without item is permanently rejected', () => {
    expect(() => recordToWrite(rec('stock_deplete', { quantity: 5 }), CTX))
      .toThrow(PermanentRejection);
  });
  test('machine_state without machine is permanently rejected', () => {
    expect(() => recordToWrite(rec('machine_state', { state: 'down' }), CTX))
      .toThrow(PermanentRejection);
  });
});

describe('shared qty derivation (rule-bounds)', () => {
  // A whitespace-only quantity used to be read as an explicit Number(' ')=0
  // total and permanently rejected despite valid rounds. deriveTotalQty is
  // trim-aware AND shared with the sanity net, so the judged number and the
  // landed number come from one function.
  test('whitespace quantity on a replayed record still derives rounds × round_size', () => {
    const w = recordToWrite(rec('production', {
      job: 'sep-1', machine: 'vat_a1', worker: 'w1',
      quantity: ' ', rounds: 25, round_size: 6,
    }), CTX);
    expect(w.data.qty_pcs).toBe(150);
  });
});
