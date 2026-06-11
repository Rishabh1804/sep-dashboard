// Recent-entries log shown on the handler home screen.
//
// The last N submitted records, newest first, each tagged with a sync
// status icon (✓ committed / ⏳ queued). Backed by IndexedDB so it
// survives reloads; the in-memory copy is the render source.

import { idbAvailable, idbGet, idbSet } from './idb.js';

const RECENT_KEY = 'recent_entries';
const MAX = 10;

let cache = [];

export async function loadRecent() {
  if (!idbAvailable()) return cache;
  const stored = await idbGet(RECENT_KEY).catch(() => null);
  cache = Array.isArray(stored) ? stored : [];
  return cache;
}

export function getRecent() { return cache; }

// entry: { type, summary, ts, status: 'queued' | 'synced' }
export async function pushRecent(entry) {
  cache = [entry, ...cache].slice(0, MAX);
  if (idbAvailable()) await idbSet(RECENT_KEY, cache).catch(() => {});
  return cache;
}

// Flip queued rows to synced once the queue flushes (matched by idempotency key).
export async function markRecentSynced(idempotencyKeys) {
  return markStatus(idempotencyKeys, 'synced');
}

// Flip queued rows to rejected when flush parks them — without this the home
// screen shows ⏳ forever for a record that is no longer queued at all.
export async function markRecentRejected(idempotencyKeys) {
  return markStatus(idempotencyKeys, 'rejected');
}

async function markStatus(idempotencyKeys, status) {
  const set = new Set(idempotencyKeys);
  let changed = false;
  cache = cache.map((e) => {
    if (e.status === 'queued' && set.has(e.idempotencyKey)) { changed = true; return { ...e, status }; }
    return e;
  });
  if (changed && idbAvailable()) await idbSet(RECENT_KEY, cache).catch(() => {});
  return cache;
}
