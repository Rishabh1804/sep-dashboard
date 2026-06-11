import { summarizeQueue, chipState } from '../../src/handler/sync.js';

describe('summarizeQueue()', () => {
  test('empty queue', () => {
    expect(summarizeQueue([])).toEqual({ total: 0, byType: {}, since: null });
  });

  test('groups by type, totals, and finds the oldest timestamp', () => {
    const recs = [
      { type: 'production', ts: 300 },
      { type: 'production', ts: 100 },
      { type: 'note', ts: 200 },
    ];
    const s = summarizeQueue(recs);
    expect(s.total).toBe(3);
    expect(s.byType).toEqual({ production: 2, note: 1 });
    expect(s.since).toBe(100);
  });
});

describe('chipState()', () => {
  test('live queue truth outranks a stale rejected record', () => {
    // A parked rejection persists until someone deals with it; it must not
    // mask "Not sent (N)" / "Syncing (N)" for the records still in flight.
    expect(chipState({ pending: 5, online: true, rejected: 1 }).state).toBe('syncing');
    expect(chipState({ pending: 5, online: false, rejected: 1 }).state).toBe('offline');
  });

  test('rejected surfaces once the queue is clean', () => {
    expect(chipState({ pending: 0, online: true, rejected: 1 }).state).toBe('rejected');
  });

  test('synced when nothing is pending', () => {
    expect(chipState({ pending: 0, online: true, rejected: 0 }).state).toBe('synced');
  });

  test('syncing when online with pending writes', () => {
    const s = chipState({ pending: 4, online: true, rejected: 0 });
    expect(s.state).toBe('syncing');
    expect(s.count).toBe(4);
  });

  test('offline copy when there are pending writes and no network', () => {
    const s = chipState({ pending: 7, online: false, rejected: 0 });
    expect(s.state).toBe('offline');
    expect(s.count).toBe(7);
  });
});
