// Offline write queue + sync chip + pre-flush confirmation.
//
// Phase 5/7 locks: the handler is offline-first. Every submitted record
// lands in an IndexedDB queue FIRST, then a transport drains it. In
// Stage C there is no Firebase yet, so the default transport rejects and
// records simply stay queued ("Saved on phone, not yet sent") — honest,
// not fake. Stage B injects a real transport via setTransport().
//
// The chip never communicates by colour alone (Phase 7 HIGH fix): it
// carries an icon + explicit text + a count.

import { idbAvailable, idbScan, idbSet, idbDel } from './idb.js';
import { t } from './i18n.js';
import { markRecentSynced, markRecentRejected } from './recent.js';

const QUEUE_PREFIX = 'queue:';
const REJECTED_PREFIX = 'rejected:';
const LAST_SYNC_KEY = 'sep_handler_last_sync';

let held = false; // user can pause auto-flush from the sync sheet

// --- Transport seam (Stage B swaps this for a Firestore writer) ---
const NO_TRANSPORT = async () => { throw new Error('no-transport'); };
let transport = NO_TRANSPORT;
let transportReady = false;
export function setTransport(fn) { transport = fn; transportReady = true; }
// Sign-out path: without this the chip would keep claiming "syncing" against
// an auth the transport can no longer use — the dishonest state Phase 5/7 forbid.
export function clearTransport() { transport = NO_TRANSPORT; transportReady = false; }
export function isTransportReady() { return transportReady; }

// --- Queue ops ---
export async function enqueueWrite(record) {
  const key = `${QUEUE_PREFIX}${record.ts}:${record.idempotencyKey}`;
  if (idbAvailable()) await idbSet(key, record).catch(() => {});
  return key;
}

export async function listQueue() {
  if (!idbAvailable()) return [];
  const rows = await idbScan(QUEUE_PREFIX).catch(() => []);
  return rows.map((r) => ({ key: r.key, record: r.value }))
    .sort((a, b) => (a.record.ts || 0) - (b.record.ts || 0));
}

export async function queueCount() { return (await listQueue()).length; }

// Permanently-rejected records (rules said no — retrying an identical doc
// gets an identical verdict). Parked here so they never wedge the queue;
// surfaced via the chip + sync sheet. The steward inbox (Stage F) is the
// proper review surface; discard-from-sheet is the alpha affordance.
export async function listRejected() {
  if (!idbAvailable()) return [];
  const rows = await idbScan(REJECTED_PREFIX).catch(() => []);
  return rows.map((r) => ({ key: r.key, ...r.value }));
}

export async function rejectedCount() { return (await listRejected()).length; }

export async function discardRejected() {
  const rows = await listRejected();
  for (const r of rows) await idbDel(r.key).catch(() => {});
  return rows.length;
}

// Put parked records back on the queue (e.g. after a Stage D fix ships for
// the skew that rejected them). The recovery affordance that makes parking
// safe — rejected data is never one tap from oblivion only.
export async function requeueRejected() {
  const rows = await listRejected();
  for (const r of rows) {
    if (r.record) await enqueueWrite(r.record);
    await idbDel(r.key).catch(() => {});
  }
  return rows.length;
}

// Pure: roll a queue into { total, byType: {type: n}, since }.
// Kept dependency-free so it unit-tests without IndexedDB.
export function summarizeQueue(records) {
  const byType = {};
  let since = null;
  for (const rec of records) {
    byType[rec.type] = (byType[rec.type] || 0) + 1;
    if (since === null || rec.ts < since) since = rec.ts;
  }
  return { total: records.length, byType, since };
}

// Drain the queue through the transport. Resolved records leave the
// queue and flip their recent-log row to synced. Unreachable transport
// leaves everything queued and surfaces via the chip.
//
// Re-entrant calls join the in-flight drain instead of racing it — the
// triggers multiplied in Track 2 (auth ready, 'online' event, the two
// Sync-now buttons) and two concurrent drains would double-send records
// and double-count the result.
let inflight = null;
export function flush() {
  if (!inflight) {
    inflight = doFlush().finally(() => { inflight = null; });
  }
  return inflight;
}

async function doFlush() {
  if (held) return { sent: 0, rejected: 0, remaining: await queueCount() };
  const queued = await listQueue();
  const synced = [];
  const parked = [];
  for (const { key, record } of queued) {
    try {
      await transport(record);
      await idbDel(key).catch(() => {});
      synced.push(record.idempotencyKey);
    } catch (err) {
      if (err?.permanent) {
        // Content-deterministic rejection (recordToWrite pre-flight): park it
        // and keep draining — it must never block the records behind it.
        // Environmental denials (revoked token, stale build) are NOT permanent
        // and take the break below; see createTransport in transport.js.
        await idbSet(`${REJECTED_PREFIX}${key}`, { record, reason: String(err.message || err) }).catch(() => {});
        await idbDel(key).catch(() => {});
        parked.push(record.idempotencyKey);
        continue;
      }
      break; // transient (offline/unavailable/env denial); preserve order, retry whole batch later
    }
  }
  if (synced.length) {
    await markRecentSynced(synced);
    try { globalThis.localStorage?.setItem(LAST_SYNC_KEY, String(Date.now())); } catch { /* ignore */ }
  }
  if (parked.length) await markRecentRejected(parked);
  return { sent: synced.length, rejected: parked.length, remaining: queued.length - synced.length - parked.length };
}

export function setHeld(v) { held = !!v; }
export function isHeld() { return held; }
export function lastSyncTs() {
  try { return Number(globalThis.localStorage?.getItem(LAST_SYNC_KEY)) || null; } catch { return null; }
}

// --- Chip rendering ---
// Derive chip state from queue + network. Pure given its inputs.
// Priority: live queue truth first — a parked rejected record persists until
// someone deals with it, and letting it mask "Not sent (30)" indefinitely
// would defeat the chip's load-bearing "is my data on the server?" signal.
// Rejected surfaces once the queue itself is clean.
export function chipState({ pending, online, rejected }) {
  if (pending === 0 && rejected > 0) return { state: 'rejected', icon: '🔴', label: t('rejected'), count: rejected };
  if (pending === 0) return { state: 'synced', icon: '✓', label: t('synced'), count: 0 };
  if (online && !held) return { state: 'syncing', icon: '⏳', label: t('syncing'), count: pending };
  // Compact label in the chip; the full "Saved on phone, not yet sent"
  // sentence lives in the sync-status sheet so the top bar stays
  // single-line on narrow phones.
  return { state: 'offline', icon: '⚠️', label: t('not_sent'), count: pending };
}

export async function renderChip(el) {
  if (!el) return;
  const pending = await queueCount();
  // "Can we actually send?" — true network AND a wired transport. Until
  // Stage B injects the Firestore writer, transportReady is false, so
  // queued writes honestly read "Not sent" rather than claiming to sync
  // into a void.
  const online = (globalThis.navigator?.onLine !== false) && transportReady;
  const s = chipState({ pending, online, rejected: await rejectedCount() });
  el.dataset.state = s.state;
  el.innerHTML = `<span class="h-dot"></span><span>${s.icon} ${s.label}${s.count ? ` (${s.count})` : ''}</span>`;
}

// --- Pre-flush confirmation (Phase 5 lock) ---
// On app open, if writes are queued, confirm before draining. Catches
// reinstall scenarios where an unexpected queue appears.
//
// Holds the queue BEFORE showing the modal: Track 2's auth listener
// auto-flushes the moment the persisted session resolves, which would
// otherwise race past this confirmation and drain the queue while the
// user is still reading it.
export async function preFlushCheck({ onReview } = {}) {
  const queued = await listQueue();
  if (!queued.length) return;
  setHeld(true);
  const { total, byType, since } = summarizeQueue(queued.map((q) => q.record));
  const sinceStr = since ? new Date(since).toLocaleString() : '—';
  const lines = Object.entries(byType)
    .map(([type, n]) => `<li>${t(type)} × ${n}</li>`).join('');

  showModal({
    title: `${total} ${t('pending_sync')}`,
    bodyHtml: `<div>${t('pending_since')}: ${sinceStr}</div><ul>${lines}</ul>`,
    actions: [
      { label: t('review'), kind: 'ghost', onClick: (close) => { close(); onReview?.(); } },
      { label: t('sync_now'), kind: 'primary', onClick: (close) => { setHeld(false); close(); flush(); } },
      { label: t('hold'), kind: 'ghost', onClick: (close) => { setHeld(true); close(); } },
    ],
  });
}

// --- Sync status sheet (chip tap target) ---
export async function openSyncSheet(refresh) {
  const queued = await listQueue();
  const { total } = summarizeQueue(queued.map((q) => q.record));
  const rejectedRows = await listRejected();
  const online = globalThis.navigator?.onLine !== false;
  const last = lastSyncTs();
  const rejectedHtml = rejectedRows.length
    ? `<div>${t('rejected')}: <strong>${rejectedRows.length}</strong></div>
       <ul class="h-rejected-list">${rejectedRows.slice(0, 5).map((r) =>
        `<li>${t(r.record?.type || 'note')} — ${r.reason || ''}</li>`).join('')}</ul>`
    : '';
  const actions = [
    { label: t('sync_now'), kind: 'primary', onClick: async (close) => { setHeld(false); await flush(); close(); refresh?.(); } },
    { label: t('hold'), kind: 'ghost', onClick: (close) => { setHeld(true); close(); refresh?.(); } },
  ];
  if (rejectedRows.length) {
    actions.push({ label: t('requeue_rejected'), kind: 'ghost', onClick: async (close) => { await requeueRejected(); close(); refresh?.(); } });
    actions.push({ label: t('discard_rejected'), kind: 'ghost', onClick: async (close) => { await discardRejected(); close(); refresh?.(); } });
  }
  showModal({
    title: t('sync_status'),
    bodyHtml: `
      <div>${t('offline_saved')}: <strong>${total}</strong></div>
      <div>${t('last_sync')}: ${last ? new Date(last).toLocaleTimeString() : '—'}</div>
      <div>${t('network')}: ${online ? t('online') : t('offline')}</div>${rejectedHtml}`,
    actions,
  });
}

// --- Minimal modal primitive (shared by pre-flush + sheet + forms) ---
export function showModal({ title, bodyHtml, actions }) {
  if (typeof document === 'undefined') return () => {};
  const overlay = document.createElement('div');
  overlay.className = 'h-modal-overlay';
  const close = () => overlay.remove();
  overlay.innerHTML = `<div class="h-modal" role="dialog" aria-modal="true">
    <div class="h-modal-title">${title}</div>
    <div class="h-modal-body">${bodyHtml}</div>
    <div class="h-modal-actions"></div>
  </div>`;
  const actionsEl = overlay.querySelector('.h-modal-actions');
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = 'h-btn ' + (a.kind === 'primary' ? 'h-btn-primary' : 'h-btn-ghost');
    btn.textContent = a.label;
    btn.addEventListener('click', () => a.onClick(close));
    actionsEl.appendChild(btn);
  }
  document.body.appendChild(overlay);
  return close;
}
