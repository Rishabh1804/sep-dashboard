import {
  validateProductionEntry, validateDftMeasurement, validateDispatchEvent,
  applyRouteEvent, diffKeys,
} from '../../src/shared/validation/cross-doc.js';

const inFlightJob = { id: 'sep-2494', current_status: 'in-flight', route: 'standard' };
const dispatchedJob = { id: 'sep-9', current_status: 'dispatched' };

describe('validateProductionEntry', () => {
  test('passes for a valid entry against an in-flight job', () => {
    const r = validateProductionEntry(
      { machine_id: 'vat_a1', worker_id: 'sharat_mahato', qty_pcs: 150 },
      { job: inFlightJob });
    expect(r.ok).toBe(true);
  });
  test('flags missing job, dispatched job, zero qty, missing refs', () => {
    expect(validateProductionEntry({ qty_pcs: 1, machine_id: 'm', worker_id: 'w' }, { job: null }).errors)
      .toContain('job_not_found');
    expect(validateProductionEntry({ qty_kg: 5, machine_id: 'm', worker_id: 'w' }, { job: dispatchedJob }).errors)
      .toContain('job_already_dispatched');
    const noQty = validateProductionEntry({ machine_id: 'm', worker_id: 'w' }, { job: inFlightJob });
    expect(noQty.errors).toContain('quantity_required');
    const noRefs = validateProductionEntry({ qty_pcs: 10 }, { job: inFlightJob });
    expect(noRefs.errors).toEqual(expect.arrayContaining(['machine_required', 'worker_required']));
  });
  test('accepts kg-only quantity (Barrel)', () => {
    expect(validateProductionEntry({ machine_id: 'barrel', worker_id: 'sunil', qty_kg: 200 }, { job: inFlightJob }).ok)
      .toBe(true);
  });
});

describe('validateDftMeasurement', () => {
  test('hard-blocks >50 µm and requires positive', () => {
    expect(validateDftMeasurement({ micron_value: 60 }, { job: inFlightJob }).errors).toContain('micron_out_of_range');
    expect(validateDftMeasurement({ micron_value: 0 }, { job: inFlightJob }).errors).toContain('micron_required');
    expect(validateDftMeasurement({ micron_value: 10, outcome: 'pass' }, { job: inFlightJob }).ok).toBe(true);
  });
});

describe('validateDispatchEvent', () => {
  test('requires job + customer, blocks re-dispatch', () => {
    expect(validateDispatchEvent({ customer_id: 'cust-1' }, { job: inFlightJob }).ok).toBe(true);
    expect(validateDispatchEvent({ customer_id: 'cust-1' }, { job: dispatchedJob }).errors)
      .toContain('job_already_dispatched');
    expect(validateDispatchEvent({}, { job: inFlightJob }).errors).toContain('customer_required');
  });
});

describe('applyRouteEvent (event-sourced status derivation)', () => {
  test('maps station states to coarse status', () => {
    expect(applyRouteEvent(inFlightJob, { to_state: 'plating' }).current_status).toBe('in-flight');
    expect(applyRouteEvent(inFlightJob, { to_state: 'ready' }).current_status).toBe('ready');
    expect(applyRouteEvent(inFlightJob, { to_state: 'dispatched' }).current_status).toBe('dispatched');
  });
  test('rework sets route active; dispatch after rework marks completed', () => {
    expect(applyRouteEvent(inFlightJob, { to_state: 'rework' }).route).toBe('rework-active');
    expect(applyRouteEvent({ ...inFlightJob, route: 'rework-active' }, { to_state: 'dispatched' }).route)
      .toBe('rework-completed');
  });
});

describe('diffKeys', () => {
  test('returns only changed keys', () => {
    expect(diffKeys({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 }).sort()).toEqual(['b', 'c']);
    expect(diffKeys({ a: 1 }, { a: 1 })).toEqual([]);
  });
});
