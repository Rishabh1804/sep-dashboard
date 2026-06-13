// Cloud Functions — Phase 2 Stage E.
//
// The load-bearing *logic* is pure and lives + is unit-tested in the web app at
// src/shared/validation/cross-doc.js; these wrappers are thin Firestore-trigger
// / callable shells around it. See CLOUD_FUNCTION_HOOKS.md + EVENT_SOURCING.md.
//
// DEPLOY: firebase deploy bundles ONLY this functions/ dir, so the shared pure
// logic is VENDORED in (functions/vendor/cross-doc.js) by functions/vendor.mjs,
// run from firebase.json's predeploy. vendor/ is gitignored and generated — never
// committed — so the deployed artifact is always a fresh copy of the source and
// there is no second copy to drift. Edit the source, never the vendor copy.
// (`pnpm --prefix functions lint` regenerates it then node --checks this entry.)
//
// IAM: the deploy path is gated — see scripts/deploy-functions.mjs for the exact
// roles the staging service account needs (deploy-rules' grant is NOT enough).

import { setGlobalOptions, logger } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Pure logic shared with the web app + unit tests (vendored at deploy).
import {
  validateProductionEntry, validateDftMeasurement, validateDispatchEvent,
  applyRouteEvent, applyDispatchEvent, applyShiftEvent, applyStateTransition,
  shouldApplyEvent, diffKeys,
} from './vendor/cross-doc.js';

// Staging lives in asia-south1 (Session 14); keep the functions co-located with
// Firestore to cut round-trip latency on the aggregator transactions.
setGlobalOptions({ region: 'asia-south1' });

// Always-warm aggregators (CONFLICT_RESOLUTION.md + CLOUD_FUNCTION_HOOKS.md lock
// min-instances=1 for prod's "data backbone" — cold start is 1-10s, and a
// shift-open's first event shouldn't eat that. Staging defaults to 0 to stay in
// the free tier; prod sets AGG_MIN_INSTANCES=1.
const AGG_MIN_INSTANCES = Number(process.env.AGG_MIN_INSTANCES || 0);

initializeApp();
const db = () => getFirestore();

// --- auditEventGenerator: append an audit_event on every collection write ---
const AUDITED = ['customers', 'items', 'jobs', 'workers', 'machines', 'stock_items',
  'production_entries', 'dft_measurements', 'dispatch_events', 'notes'];

export const auditEventGenerator = AUDITED.reduce((acc, coll) => {
  acc[`audit_${coll}`] = onDocumentWritten(`${coll}/{id}`, async (event) => {
    const before = event.data?.before?.data() || null;
    const after = event.data?.after?.data() || null;
    const action = !before ? 'create' : !after ? 'delete' : 'update';
    await db().collection('audit_events').add({
      __schema_version: 2,
      entity_type: coll.replace(/s$/, ''),
      entity_id: event.params.id,
      action,
      field_changed: diffKeys(before, after),
      triggered_by_user: after?.author_user_id || before?.author_user_id || 'system',
      triggered_by_app: after?.recorded_by_app || 'cf',
      recorded_at: FieldValue.serverTimestamp(),
      app_version: after?.app_version || null,
    });
  });
  return acc;
}, {});

// --- crossDocValidator callables: validate against related docs, then write ---
async function getJob(jobId) {
  if (!jobId) return null;
  const snap = await db().doc(`jobs/${jobId}`).get();
  return snap.exists ? snap.data() : null;
}

export const createProductionEntry = onCall(async (req) => {
  const entry = req.data || {};
  const res = validateProductionEntry(entry, { job: await getJob(entry.job_id) });
  if (!res.ok) throw new HttpsError('failed-precondition', res.errors.join(','));
  const ref = await db().collection('production_entries').add({
    ...entry, __schema_version: 2, recorded_by_app: 'handler',
    created_at: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

export const createDftMeasurement = onCall(async (req) => {
  const m = req.data || {};
  const res = validateDftMeasurement(m, { job: await getJob(m.job_id) });
  if (!res.ok) throw new HttpsError('failed-precondition', res.errors.join(','));
  const ref = await db().collection('dft_measurements').add({
    ...m, __schema_version: 2, created_at: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

export const createDispatchEvent = onCall(async (req) => {
  const d = req.data || {};
  const res = validateDispatchEvent(d, { job: await getJob(d.job_id) });
  if (!res.ok) throw new HttpsError('failed-precondition', res.errors.join(','));
  const ref = await db().collection('dispatch_events').add({
    ...d, __schema_version: 2, created_at: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

// --- eventSourcingAggregator (Stage E): derive parent doc state from append-
// only event streams. Each aggregator is idempotent (shouldApplyEvent guards
// duplicate triggers + out-of-order replay) and transactional (single writer
// per parent doc, no conflict surface). EVENT_SOURCING.md.

/**
 * Fold one event into its parent doc inside a transaction.
 * - requireParent: jobs are seeded ground truth — never fabricate one from a
 *   stray dispatch/route event (merge would write a status-only orphan). Worker
 *   and Machine derived parents, by contrast, are *meant* to be created by their
 *   first event, so they merge-create.
 */
async function foldEvent(parentRef, sub, derive, eventData, eventId, { requireParent = false } = {}) {
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(parentRef);
    if (!snap.exists && requireParent) {
      // The event references a parent that isn't in Firestore yet (e.g. a
      // dispatch whose job-receipt write is still in the offline queue).
      // onDocumentCreated fires once and isn't re-driven, so a silent return
      // would strand the fold forever — log it so it's greppable and a
      // reconciliation sweep can pick it up. (Sweep is a tracked follow-up.)
      logger.warn('aggregator: parent missing, fold skipped', { parent: parentRef.path, sub, eventId });
      return;
    }
    const parent = snap.exists ? snap.data() : {};
    const decision = shouldApplyEvent(parent, eventData, eventId, sub);
    if (!decision.apply) return;
    tx.set(parentRef, {
      ...derive(parent, eventData),
      ...decision.bookkeeping,
      // Mark a derived parent the aggregator itself created (worker/machine
      // status projections) so the dashboard can tell it apart from a seeded
      // master record that carries name/roles/area.
      ...(snap.exists ? {} : { __derived: true }),
      last_updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

// Dispatch (the named Stage E gap): handler writes top-level dispatch_events but
// never flips jobs/{job_id}.current_status. This closes it.
export const dispatchStatusAggregator = onDocumentCreated(
  { document: 'dispatch_events/{id}', minInstances: AGG_MIN_INSTANCES },
  async (event) => {
    const data = event.data?.data();
    if (!data?.job_id) return;
    await foldEvent(db().doc(`jobs/${data.job_id}`), 'dispatch',
      applyDispatchEvent, data, event.params.id, { requireParent: true });
  },
);

// Worker.current_status from the shift stream (check-in/out events).
export const workerShiftAggregator = onDocumentCreated(
  { document: 'workers/{wid}/shifts/{id}', minInstances: AGG_MIN_INSTANCES },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await foldEvent(db().doc(`workers/${event.params.wid}`), 'shifts',
      applyShiftEvent, data, event.params.id);
  },
);

// Machine.current_status from the state-transition stream.
export const machineStateAggregator = onDocumentCreated(
  { document: 'machines/{mid}/state_transitions/{id}', minInstances: AGG_MIN_INSTANCES },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await foldEvent(db().doc(`machines/${event.params.mid}`), 'stateTransitions',
      applyStateTransition, data, event.params.id);
  },
);

// Route-history aggregator (kept from the skeleton): derives status from the
// jobs/{jid}/route_history subcollection for the route-based lifecycle. The
// handler doesn't write route_history today, but the Inspector role-app + the
// dashboard route editor will — so the path stays live.
export const routeHistoryAggregator = onDocumentCreated(
  { document: 'jobs/{jid}/route_history/{id}', minInstances: AGG_MIN_INSTANCES },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await foldEvent(db().doc(`jobs/${event.params.jid}`), 'routeHistory',
      applyRouteEvent, data, event.params.id, { requireParent: true });
  },
);
