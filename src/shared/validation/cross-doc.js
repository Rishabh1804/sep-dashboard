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

/** Audit helper: keys whose values changed between two doc snapshots. */
export function diffKeys(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed = [];
  for (const k of keys) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) changed.push(k);
  }
  return changed;
}
