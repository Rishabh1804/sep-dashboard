import { eventMillis } from '../../src/shared/utils/event-time.js';

// The three created_at shapes that coexist in this system (see module header):
// live Timestamp, seeded ISO string, pending-serverTimestamp null.
describe('eventMillis()', () => {
  test('Firestore Timestamp → toMillis()', () => {
    expect(eventMillis({ created_at: { toMillis: () => 1765432100000 } })).toBe(1765432100000);
  });

  test('seeded ISO string → parsed (the 2,494-doc FY27 seed shape)', () => {
    expect(eventMillis({ created_at: '2026-06-10T00:00:00.000Z' }))
      .toBe(Date.parse('2026-06-10T00:00:00.000Z'));
  });

  test('pending serverTimestamp (null) falls back to client_ts — offline record sorts newest, not 0', () => {
    expect(eventMillis({ created_at: null, client_ts: 1765432100123 })).toBe(1765432100123);
  });

  test('unparseable string falls back to client_ts, then 0', () => {
    expect(eventMillis({ created_at: 'not-a-date', client_ts: 42 })).toBe(42);
    expect(eventMillis({ created_at: 'not-a-date' })).toBe(0);
  });

  test('missing everything → 0; null/undefined doc safe', () => {
    expect(eventMillis({})).toBe(0);
    expect(eventMillis(null)).toBe(0);
    expect(eventMillis(undefined)).toBe(0);
  });
});
