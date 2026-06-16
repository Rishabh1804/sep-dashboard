#!/usr/bin/env node
// Behavioural verification of the Stage E dispatchStatusAggregator against the
// LIVE staging deployment. Proves the actual deliverable: a dispatch_event
// landing flips its Job.current_status to 'dispatched'.
//
// Admin-SDK harness (not the client transport): it needs to find a seeded job,
// observe the async CF result, and — critically — CLEAN UP so the seed stays
// intact. The aggregator fires on ANY create of dispatch_events/{id}, so an
// admin write exercises the same trigger the handler does.
//
// Flow: pick an in-flight seeded job → write one dispatch_events doc → poll the
// job until current_status === 'dispatched' (CF is async; ~seconds) → then, in
// a finally, delete the test event + restore the job (status/route) + clear the
// dispatch bookkeeping fields. Leaves staging exactly as it found it.
//
// Usage: node scripts/verify-aggregator-staging.mjs   (needs admin credentials)

import { exit } from 'node:process';
import { initAdminApp } from './lib/admin.mjs';
import { BUILD } from '../src/shared/config/app.js';

const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const db = getFirestore(await initAdminApp());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = `verify-dispatch-${Date.now()}`;
let jobRef = null;
let prior = null;

try {
  // 1. Find a seeded in-flight job (any one — the importer writes them all
  //    current_status:'in-flight'). Capture prior state for restore.
  const q = await db.collection('jobs').where('current_status', '==', 'in-flight').limit(1).get();
  if (q.empty) { console.error('[agg] FAIL — no in-flight job found to test against'); exit(1); }
  const jobSnap = q.docs[0];
  jobRef = jobSnap.ref;
  const jobId = jobSnap.id;
  prior = { current_status: jobSnap.get('current_status'), route: jobSnap.get('route') ?? 'standard' };
  console.log(`[agg] target job ${jobId} (was ${prior.current_status}/${prior.route})`);

  // 2. Write one dispatch_event — the envelope the aggregator reads (job_id +
  //    created_at + client_ts). customer_id included for realism.
  await db.collection('dispatch_events').doc(key).set({
    job_id: jobId,
    customer_id: jobSnap.get('customer_id') || null,
    author_user_id: 'verify-rig',
    app_version: String(BUILD),
    client_ts: Date.now(),
    created_at: FieldValue.serverTimestamp(),
    idempotency_key: key,
    notes: 'Stage E aggregator behavioural verification (auto-cleanup)',
  });
  console.log(`[agg] wrote dispatch_events/${key}; waiting for dispatchStatusAggregator to flip status…`);

  // 3. Poll the parent job for the CF-derived flip (async; allow cold start).
  let flipped = false;
  for (let i = 0; i < 30; i++) { // ~60s budget
    await sleep(2000);
    const s = await jobRef.get();
    if (s.get('current_status') === 'dispatched') {
      flipped = true;
      console.log(`[agg] ✅ job ${jobId} flipped to 'dispatched' after ~${(i + 1) * 2}s`
        + ` (route ${s.get('route')}, cursor ${s.get('last_applied_event_id_dispatch')})`);
      break;
    }
  }
  if (!flipped) { console.error(`[agg] FAIL — job ${jobId} never flipped to 'dispatched' within budget`); exit(1); }
  console.log('\n[agg] ✅ Stage E verified end-to-end: dispatch_event → CF → Job.current_status=dispatched');
} finally {
  // 4. Restore: delete the test event + reset the job + clear dispatch cursor.
  //    Runs even on failure so a half-run never corrupts the seed.
  try {
    if (key) await db.collection('dispatch_events').doc(key).delete();
    if (jobRef && prior) {
      await jobRef.update({
        current_status: prior.current_status,
        route: prior.route,
        last_applied_event_id_dispatch: FieldValue.delete(),
        last_applied_server_dispatch: FieldValue.delete(),
        last_applied_client_dispatch: FieldValue.delete(),
      });
      console.log(`[agg] cleanup done — job restored to ${prior.current_status}/${prior.route}, test event deleted`);
    }
  } catch (e) {
    console.error('[agg] ⚠ cleanup error (manual check advised):', e?.message || e);
  }
}
exit(0);
