// Rule-bounds — the single-source contract: shared derivation + coupling
// tests that pin every consumer (forms registry, sanity, write schemas, edit
// specs) to the same constants, so a rules change can't silently drift.
import {
  QTY_MAX, PCS_MAX, DFT_MICRON_MAX,
  RULE_STATIONS, JOB_ROUTES, DEPLETION_REASONS, DFT_OUTCOMES,
  NOTE_PRIORITIES, MACHINE_STATES, CHECK_DIRECTIONS, CHECK_SLOTS,
  deriveTotalQty,
} from '../../src/shared/types/rule-bounds.js';
import { validateWrite, validateEditField } from '../../src/shared/types/handler-writes.js';
import { FORMS } from '../../src/handler/forms-registry.js';
import { SANITY, statKey, checkRecord, MIN_HISTORY, pushStat, emptyStats } from '../../src/handler/sanity.js';
import { FIELD_SPECS, buildEditPayload } from '../../src/dashboard/edit-model.js';
import { JOB_STATUSES } from '../../src/shared/types/job-status.js';

describe('deriveTotalQty — the one production-quantity derivation', () => {
  test('explicit total wins over rounds × round_size', () => {
    expect(deriveTotalQty({ quantity: 450, rounds: 25, round_size: 18 })).toBe(450);
  });
  test('rounds × round_size when no total', () => {
    expect(deriveTotalQty({ rounds: 25, round_size: 6 })).toBe(150);
  });
  test('whitespace-only quantity is "not entered" — still derives', () => {
    expect(deriveTotalQty({ quantity: ' ', rounds: 25, round_size: 6 })).toBe(150);
  });
  test('nothing usable → undefined (never a fabricated 0)', () => {
    expect(deriveTotalQty({})).toBeUndefined();
    expect(deriveTotalQty({ rounds: 25 })).toBeUndefined();
    expect(deriveTotalQty({ quantity: '' })).toBeUndefined();
  });
});

describe('coupling: registry select options ⊆ the shared enums', () => {
  // (formId, fieldKey) → the enum that gates it at the write boundary.
  const ENUM_FOR = {
    'production.station': RULE_STATIONS,
    'stock_deplete.reason': DEPLETION_REASONS,
    'machine_state.state': MACHINE_STATES,
    'check_in.direction': CHECK_DIRECTIONS,
    'check_in.slot': CHECK_SLOTS,
    'dft.outcome': DFT_OUTCOMES,
    'note.priority': NOTE_PRIORITIES,
  };
  test('every mapped select offers only values the write schema accepts', () => {
    for (const def of FORMS) {
      for (const f of def.fields) {
        const allowed = ENUM_FOR[`${def.id}.${f.key}`];
        if (!allowed || !f.options) continue;
        for (const o of f.options) expect(allowed).toContain(o.value);
      }
    }
  });
  test('edit-surface select options ⊆ the same enums', () => {
    const map = {
      'jobs.current_status': JOB_STATUSES,
      'jobs.route': JOB_ROUTES,
      'dft_measurements.outcome': DFT_OUTCOMES,
      'depletions.reason': DEPLETION_REASONS,
      'shifts.direction': CHECK_DIRECTIONS,
      'shifts.slot': CHECK_SLOTS,
    };
    for (const [path, allowed] of Object.entries(map)) {
      const [coll, key] = path.split('.');
      const spec = FIELD_SPECS[coll].find((s) => s.key === key);
      for (const v of spec.options) expect(allowed).toContain(v);
    }
  });
  test('sanity caps equal the rules caps', () => {
    expect(SANITY.production.quantity.hardMax).toBe(QTY_MAX);
    expect(SANITY.job_receipt.received_pcs.hardMax).toBe(PCS_MAX);
    // DFT deliberately has NO hardMax (50 is inclusive-legal; the form's
    // dftRange owns the > DFT_MICRON_MAX bound) — pin that ruling.
    expect(SANITY.dft.dft_micron.hardMax).toBeUndefined();
  });
  test('the write schema accepts the inclusive DFT cap and rejects beyond it', () => {
    const base = { job_id: 'j1', outcome: 'pass' };
    expect(validateWrite('dft', { ...base, micron_value: DFT_MICRON_MAX }).ok).toBe(true);
    expect(validateWrite('dft', { ...base, micron_value: DFT_MICRON_MAX + 0.1 }).ok).toBe(false);
  });
  test('the write schema rejects the exclusive qty cap itself', () => {
    const base = { job_id: 'j', machine_id: 'm', worker_id: 'w', station: 'plating' };
    expect(validateWrite('production', { ...base, qty_pcs: QTY_MAX }).ok).toBe(false);
    expect(validateWrite('production', { ...base, qty_pcs: QTY_MAX - 1 }).ok).toBe(true);
  });
});

describe('statKey — unit-scoped σ baselines', () => {
  test('production scopes by machine group; stock forms by item', () => {
    expect(statKey('production', 'quantity', { machine: 'vat_a1' })).toBe('quantity@vat');
    expect(statKey('production', 'quantity', { machine: 'barrel' })).toBe('quantity@barrel');
    expect(statKey('stock_deplete', 'quantity', { item: 'hcl' })).toBe('quantity@hcl');
  });
  test('unscoped fallback when the scoping field is unset', () => {
    expect(statKey('production', 'quantity', {})).toBe('quantity');
    expect(statKey('dft', 'dft_micron', { machine: 'vat_a1' })).toBe('dft_micron');
  });
  test('a mature VAT baseline never judges a barrel entry', () => {
    // 12 tight VAT entries around 3000 pcs → σ net active for quantity@vat.
    let s = emptyStats();
    for (let i = 0; i < 12; i++) s = pushStat(s, 3000 + (i % 3) * 10);
    expect(s.n).toBeGreaterThanOrEqual(MIN_HISTORY);
    const baselines = { 'quantity@vat': s };
    // A routine 120 kg barrel entry would be wildly outside the VAT
    // distribution — but it reads quantity@barrel (no history) and passes.
    const barrel = checkRecord('production', { quantity: 120, machine: 'barrel' }, baselines);
    expect(barrel).toEqual([]);
    // The same value ON a VAT machine is judged against the VAT baseline.
    const vat = checkRecord('production', { quantity: 120, machine: 'vat_a1' }, baselines);
    expect(vat[0]).toMatchObject({ key: 'quantity', level: 'confirm' });
  });
});

describe('edit gate — the admin path enforces the same bounds', () => {
  const edit = (path, before, key, raw) => buildEditPayload({
    path, before, values: { [key]: raw }, reason: 'typo', uid: 'admin-1', now: 1,
  });
  test('a legal edit passes', () => {
    const r = edit('dft_measurements/d1', { micron_value: 9 }, 'micron_value', '11');
    expect(r.ok).toBe(true);
    expect(r.updates.micron_value).toBe(11);
  });
  test('an out-of-bounds DFT edit is refused with the field named', () => {
    const r = edit('dft_measurements/d1', { micron_value: 9 }, 'micron_value', '500');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/micron_value/);
  });
  test('a status outside the enum is refused (select bypass / stale build)', () => {
    const r = edit('jobs/j1', { current_status: 'in-flight' }, 'current_status', 'shipped');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/current_status/);
  });
  test('fields the rules do not judge stay editable (notes, challan_no)', () => {
    const r = edit('jobs/j1', { challan_no: '100' }, 'challan_no', '2232');
    expect(r.ok).toBe(true);
  });
  test('validateEditField ignores unknown collections/fields', () => {
    expect(validateEditField('unknown_coll', 'x', 'y').ok).toBe(true);
    expect(validateEditField('jobs', 'not_a_field', 123).ok).toBe(true);
  });
});
