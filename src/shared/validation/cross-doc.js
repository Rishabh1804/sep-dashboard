// Cross-document validation + derivation logic (Stage B, Track 1).
//
// Firestore rules enforce identity/attribution and single-doc invariants; they
// CANNOT see across documents (CLOUD_FUNCTION_HOOKS.md). The cross-doc checks
// live in Cloud Functions — but the *rules* themselves are pure functions, so
// they live here, web-importable and unit-tested, and the CF wrappers in
// functions/ are thin. Same logic can also pre-validate client-side before a
// write is queued.
//
// Each validator takes the candidate record + a context of already-fetched
// related docs, and returns { ok, errors }. They never read Firestore
// themselves — the caller (CF or client) supplies context — which is exactly
// what keeps them pure and testable.

function fail(errors) { return { ok: errors.length === 0, errors }; }

/**
 * production_entries write. ctx.job = the referenced Job doc (or null/undefined).
 */
export function validateProductionEntry(entry = {}, ctx = {}) {
  const e = [];
  if (!ctx.job) e.push('job_not_found');
  else if (ctx.job.current_status === 'dispatched') e.push('job_already_dispatched');
  const pcs = Number(entry.qty_pcs) || 0;
  const kg = Number(entry.qty_kg) || 0;
  if (pcs <= 0 && kg <= 0) e.push('quantity_required');
  if (!entry.machine_id) e.push('machine_required');
  if (!entry.worker_id) e.push('worker_required');
  return fail(e);
}

/**
 * dft_measurements write. ctx.job = the referenced Job doc.
 */
export function validateDftMeasurement(m = {}, ctx = {}) {
  const e = [];
  if (!ctx.job) e.push('job_not_found');
  const micron = Number(m.micron_value);
  if (!Number.isFinite(micron) || micron <= 0) e.push('micron_required');
  else if (micron > 50) e.push('micron_out_of_range'); // hard block (SCHEMA: 0-50)
  if (m.outcome && !['pass', 'fail-rework'].includes(m.outcome)) e.push('bad_outcome');
  return fail(e);
}

/**
 * dispatch_events write. ctx.job = the referenced Job doc.
 */
export function validateDispatchEvent(d = {}, ctx = {}) {
  const e = [];
  if (!ctx.job) e.push('job_not_found');
  else if (ctx.job.current_status === 'dispatched') e.push('job_already_dispatched');
  if (!d.customer_id) e.push('customer_required');
  return fail(e);
}

// --- Event-sourced derivation (eventSourcingAggregator core) ---

const STATE_TO_STATUS = {
  received: 'in-flight', pickling: 'in-flight', plating: 'in-flight',
  passivation: 'in-flight', 'fg-strip': 'in-flight', inspection: 'in-flight',
  rework: 'in-flight', ready: 'ready', dispatched: 'dispatched',
};

/**
 * Derive a Job's coarse status from a route_history event applied to prior
 * state. Pure: (parentJob, event) → partial update. Mirrors the aggregator's
 * applyRouteEvent (CLOUD_FUNCTION_HOOKS.md), minus the Firestore transaction.
 */
export function applyRouteEvent(job = {}, event = {}) {
  const to = event.to_state;
  const status = STATE_TO_STATUS[to] || job.current_status || 'in-flight';
  const patch = { current_status: status };
  if (to === 'rework') patch.route = 'rework-active';
  if (to === 'dispatched') patch.route = job.route === 'rework-active' ? 'rework-completed' : (job.route || 'standard');
  return patch;
}

// Worker.current_status from a shift event. The handler writes direction
// 'in' | 'out' (transport.check_in → workers/{wid}/shifts). 'in' ⇒ on the
// floor, 'out' ⇒ left. slot (morning_ot / regular / evening_ot) rides along
// as the current slot for the payroll-aware floor view.
const SHIFT_TO_STATUS = { in: 'on-shift', out: 'off-shift' };

export function applyShiftEvent(worker = {}, event = {}) {
  const patch = { current_status: SHIFT_TO_STATUS[event.direction] || worker.current_status || 'off-shift' };
  if (event.slot) patch.current_slot = event.slot;
  return patch;
}

// Machine.current_status from a state_transition event. The handler writes
// state 'running' | 'idle' | 'down' (transport.machine_state). The state
// vocabulary IS the status vocabulary — pass through (EVENT_SOURCING.md:
// "latest event's to_state"). Capacity-state machines may carry capacity_kg.
export function applyStateTransition(machine = {}, event = {}) {
  const patch = { current_status: event.state || machine.current_status || 'unknown' };
  if (event.capacity_kg != null) patch.current_capacity_kg = Number(event.capacity_kg);
  return patch;
}

// Dispatch is a terminal status flip. dispatch_events carry no to_state; their
// existence means the job left the floor. Reuses applyRouteEvent so the
// rework-completion bookkeeping stays in one place (Job.route).
export function applyDispatchEvent(job = {}, _event = {}) {
  return applyRouteEvent(job, { to_state: 'dispatched' });
}

// --- Aggregator idempotency + ordering (CONFLICT_RESOLUTION.md: server-primary
// + client tiebreaker). The aggregator persists per-subcollection bookkeeping
// on the parent doc; these pure helpers decide whether an incoming event
// supersedes what's already folded in. Kept pure so they unit-test without
// Firestore; the CF wrapper in functions/ supplies the transaction.

/** Coerce a Firestore Timestamp / Date / number / ISO string to epoch ms. */
export function toMillis(t) {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') { const n = Date.parse(t); return Number.isNaN(n) ? null : n; }
  if (t instanceof Date) return t.getTime();
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.toDate === 'function') return t.toDate().getTime();
  if (typeof t._seconds === 'number') return t._seconds * 1000 + Math.floor((t._nanoseconds || 0) / 1e6);
  if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}

/**
 * Decide whether `event` (id `eventId`) should be applied to `parent` for the
 * subcollection key `sub`. Pure. Returns { apply, bookkeeping? }:
 *  - Exact-id replay ⇒ skip (idempotency: a duplicate trigger is a no-op).
 *  - Otherwise server-time wins; client_created (client_ts) breaks ties; the
 *    event id is the final deterministic tiebreak so two same-instant events
 *    still order stably. An out-of-order older event therefore can't clobber a
 *    newer applied state (terminal dispatch is unaffected — it's idempotent).
 *
 * Bookkeeping field names keep the documented `last_applied_event_id_<sub>`
 * convention (EVENT_SOURCING.md / CLOUD_FUNCTION_HOOKS.md / the original
 * skeleton) so a replay/rebuild tool written off the spec still finds the
 * cursor; the two `*_server_` / `*_client_` fields are the ordering additions.
 * `sub` MUST be unique per parent doc — two aggregators on the same parent
 * (jobs carries both 'dispatch' and 'routeHistory') would otherwise share a
 * cursor and treat each other's events as replays.
 */
function finiteMs(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : -1;
}

export function shouldApplyEvent(parent = {}, event = {}, eventId = '', sub = '') {
  const lastId = parent[`last_applied_event_id_${sub}`] || '';
  if (eventId && lastId && eventId === lastId) return { apply: false };
  const curServer = toMillis(event.created_at) ?? -1;
  const curClient = finiteMs(event.client_ts); // 0 is a real client_ts, not "missing"
  const lastServer = parent[`last_applied_server_${sub}`] ?? -1;
  const lastClient = parent[`last_applied_client_${sub}`] ?? -1;
  let newer;
  if (curServer !== lastServer) newer = curServer > lastServer;
  else if (curClient !== lastClient) newer = curClient > lastClient;
  else newer = eventId > lastId;
  if (!newer) return { apply: false };
  return {
    apply: true,
    bookkeeping: {
      [`last_applied_event_id_${sub}`]: eventId,
      [`last_applied_server_${sub}`]: curServer,
      [`last_applied_client_${sub}`]: curClient,
    },
  };
}

/** Audit helper: keys whose values changed between two doc snapshots. */
export function diffKeys(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed = [];
  for (const k of keys) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) changed.push(k);
  }
  return changed;
}
