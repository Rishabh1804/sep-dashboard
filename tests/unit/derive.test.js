// Stage E aggregator derivations + ordering guard — the pure core of the
// eventSourcingAggregator CFs (functions/src/index.js). The CF wrappers add only
// the Firestore transaction; everything that can go wrong in the *logic* is
// here, where it runs in jsdom in <1s rather than against a live project.

import {
  applyDispatchEvent, applyShiftEvent, applyStateTransition,
  toMillis, shouldApplyEvent,
} from '../../src/shared/validation/cross-doc.js';

describe('applyDispatchEvent (the named Stage E gap)', () => {
  test('flips an in-flight job to dispatched', () => {
    const p = applyDispatchEvent({ id: 'sep-1', current_status: 'in-flight', route: 'standard' }, {});
    expect(p.current_status).toBe('dispatched');
    expect(p.route).toBe('standard');
  });
  test('marks rework-completed when dispatched out of an active rework', () => {
    const p = applyDispatchEvent({ current_status: 'in-flight', route: 'rework-active' }, {});
    expect(p.route).toBe('rework-completed');
  });
  test('is idempotent — re-dispatching an already-dispatched job stays dispatched', () => {
    const once = applyDispatchEvent({ current_status: 'in-flight', route: 'rework-active' }, {});
    const twice = applyDispatchEvent({ current_status: 'dispatched', ...once }, {});
    expect(twice.current_status).toBe('dispatched');
    expect(twice.route).toBe('rework-completed');
  });
});

describe('applyShiftEvent (Worker.current_status)', () => {
  test("'in' ⇒ on-shift, 'out' ⇒ off-shift, slot rides along", () => {
    expect(applyShiftEvent({}, { direction: 'in', slot: 'morning_ot' }))
      .toEqual({ current_status: 'on-shift', current_slot: 'morning_ot' });
    expect(applyShiftEvent({}, { direction: 'out' }).current_status).toBe('off-shift');
  });
  test('unknown direction keeps prior status (or defaults off-shift)', () => {
    expect(applyShiftEvent({ current_status: 'on-shift' }, { direction: '?' }).current_status).toBe('on-shift');
    expect(applyShiftEvent({}, {}).current_status).toBe('off-shift');
  });
});

describe('applyStateTransition (Machine.current_status)', () => {
  test('passes the state vocabulary through and carries capacity when present', () => {
    expect(applyStateTransition({}, { state: 'running' }).current_status).toBe('running');
    expect(applyStateTransition({}, { state: 'down' }).current_status).toBe('down');
    expect(applyStateTransition({}, { state: 'idle', capacity_kg: 200 }))
      .toEqual({ current_status: 'idle', current_capacity_kg: 200 });
  });
});

describe('toMillis', () => {
  test('coerces Firestore Timestamp / Date / number / ISO / null', () => {
    expect(toMillis(1700000000000)).toBe(1700000000000);
    expect(toMillis(new Date('2026-06-13T00:00:00Z'))).toBe(Date.parse('2026-06-13T00:00:00Z'));
    expect(toMillis('2026-06-13T00:00:00Z')).toBe(Date.parse('2026-06-13T00:00:00Z'));
    expect(toMillis({ toMillis: () => 42 })).toBe(42);
    expect(toMillis({ _seconds: 2, _nanoseconds: 500_000_000 })).toBe(2500);
    expect(toMillis({ seconds: 2, nanoseconds: 0 })).toBe(2000);
    expect(toMillis(null)).toBeNull();
    expect(toMillis('not-a-date')).toBeNull();
  });
});

describe('shouldApplyEvent (idempotency + server-primary ordering)', () => {
  const sub = 'shifts';
  test('first event for a fresh parent applies and emits documented bookkeeping', () => {
    const r = shouldApplyEvent({}, { created_at: 1000, client_ts: 900 }, 'e1', sub);
    expect(r.apply).toBe(true);
    expect(r.bookkeeping).toEqual({
      last_applied_event_id_shifts: 'e1',
      last_applied_server_shifts: 1000,
      last_applied_client_shifts: 900,
    });
  });
  test('exact-id replay is a no-op (duplicate trigger)', () => {
    const parent = { last_applied_event_id_shifts: 'e1', last_applied_server_shifts: 1000, last_applied_client_shifts: 900 };
    expect(shouldApplyEvent(parent, { created_at: 9999, client_ts: 9999 }, 'e1', sub).apply).toBe(false);
  });
  test('newer server time wins; older server time is skipped (out-of-order replay)', () => {
    const parent = { last_applied_event_id_shifts: 'e1', last_applied_server_shifts: 1000, last_applied_client_shifts: 900 };
    expect(shouldApplyEvent(parent, { created_at: 2000, client_ts: 0 }, 'e2', sub).apply).toBe(true);
    expect(shouldApplyEvent(parent, { created_at: 500, client_ts: 9999 }, 'e0', sub).apply).toBe(false);
  });
  test('equal server time falls back to client_ts, then to event id', () => {
    const parent = { last_applied_event_id_shifts: 'eM', last_applied_server_shifts: 1000, last_applied_client_shifts: 900 };
    expect(shouldApplyEvent(parent, { created_at: 1000, client_ts: 950 }, 'eA', sub).apply).toBe(true);  // client newer
    expect(shouldApplyEvent(parent, { created_at: 1000, client_ts: 800 }, 'eZ', sub).apply).toBe(false); // client older
    // identical timestamps → deterministic id tiebreak ('eN' > 'eM')
    expect(shouldApplyEvent(parent, { created_at: 1000, client_ts: 900 }, 'eN', sub).apply).toBe(true);
    expect(shouldApplyEvent(parent, { created_at: 1000, client_ts: 900 }, 'eA', sub).apply).toBe(false);
  });
  test('client_ts of 0 is a real value, not "missing" (consistency with the ?? -1 server path)', () => {
    // Two events at the same server ms; the stored one has client_ts 0. An
    // incoming event with client_ts 0 must NOT be treated as newer than itself,
    // and a negative-looking coercion bug (|| -1) would have flipped this.
    const parent = { last_applied_event_id_shifts: 'eM', last_applied_server_shifts: 1000, last_applied_client_shifts: 0 };
    expect(shouldApplyEvent(parent, { created_at: 1000, client_ts: 0 }, 'eN', sub).apply).toBe(true);  // id tiebreak only
    expect(shouldApplyEvent(parent, { created_at: 1000, client_ts: 0 }, 'eA', sub).apply).toBe(false); // older id, equal times
  });
  test('parent missing a server timestamp (Firestore Timestamp shape) still orders', () => {
    const parent = {};
    const r = shouldApplyEvent(parent, { created_at: { _seconds: 1, _nanoseconds: 0 }, client_ts: 5 }, 'e1', sub);
    expect(r.apply).toBe(true);
    expect(r.bookkeeping.last_applied_server_shifts).toBe(1000);
  });
});
