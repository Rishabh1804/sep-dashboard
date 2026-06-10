// Cloud Functions — Phase 2 Stage B SKELETON.
//
// NOT DEPLOYED. This package is scaffolding for Track 2 (needs a live Firebase
// project). It is deliberately not part of the root web app's install / build /
// CI gate. The load-bearing *logic* is pure and lives + is unit-tested in the
// web app at src/shared/validation/cross-doc.js; these wrappers are thin
// Firestore-trigger / callable shells around it. See CLOUD_FUNCTION_HOOKS.md.
//
// Track 2 packaging note: deploy bundles only this functions/ dir, so the
// shared logic must be vendored in (a prebuild copy step or an npm workspace).
// Until then the import below points at the web source for reference.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Pure logic shared with the web app + unit tests (vendored at deploy — see note).
import {
  validateProductionEntry, validateDftMeasurement, validateDispatchEvent,
  applyRouteEvent, diffKeys,
} from '../../src/shared/validation/cross-doc.js';

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

// --- eventSourcingAggregator: derive Job.current_status from route_history ---
export const aggregateRouteHistory = onDocumentWritten(
  'jobs/{jid}/route_history/{eid}',
  async (event) => {
    const ev = event.data?.after?.data();
    if (!ev) return;
    const jobRef = db().doc(`jobs/${event.params.jid}`);
    await db().runTransaction(async (tx) => {
      const parent = await tx.get(jobRef);
      if (!parent.exists) return;
      const job = parent.data();
      // Idempotency: skip events already folded in (SCHEMA last_applied_event_id).
      if ((job.last_applied_event_id_routeHistory || '') >= event.params.eid) return;
      tx.update(jobRef, {
        ...applyRouteEvent(job, ev),
        last_applied_event_id_routeHistory: event.params.eid,
      });
    });
  },
);
