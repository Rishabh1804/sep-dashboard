#!/usr/bin/env node
// Live end-to-end verification against STAGING — Track 2 ignition proof.
//
// Exercises the REAL production code path: signInWithCustomToken (the QR
// provisioning auth), then createTransport() from src/handler/transport.js
// pushes one production-entry record through the deployed rules, and the
// doc is read back. This is exactly what the handler PWA does on flush.
//
// Usage: node scripts/verify-e2e-staging.mjs --token "<custom token from mint-token>"
// The minted worker must carry the 'handler' role (production-role holder).

import { exit } from 'node:process';
import { arg } from './lib/admin.mjs';
import { getFirebaseConfig } from '../src/shared/config/firebase.js';
import { createTransport } from '../src/handler/transport.js';

const token = arg('token');
if (!token) { console.error('Usage: node scripts/verify-e2e-staging.mjs --token "<custom token>"'); exit(2); }

const { initializeApp } = await import('firebase/app');
const fs = await import('firebase/firestore');
const { getAuth, signInWithCustomToken } = await import('firebase/auth');

const app = initializeApp(getFirebaseConfig('staging'));
const db = fs.getFirestore(app); // memory cache — Node has no IndexedDB
const auth = getAuth(app);

console.log('[e2e] signing in with custom token…');
const cred = await signInWithCustomToken(auth, token);
console.log(`[e2e] signed in as uid=${cred.user.uid}`);

// The same record shape form.js buildRecord() queues on the device.
const record = {
  type: 'production',
  idempotencyKey: `e2e-${Date.now()}`,
  ts: Date.now(),
  fields: {
    job: 'sep-2494', // fixture job
    machine: 'vat_a1',
    worker: cred.user.uid,
    quantity: 450,
    notes: 'Track 2 ignition e2e verification',
  },
};

const transport = createTransport({ db, auth, fs });
console.log(`[e2e] sending production entry ${record.idempotencyKey} through the real transport…`);
await transport(record);
console.log('[e2e] write ACCEPTED by the deployed rules');

const snap = await fs.getDoc(fs.doc(db, 'production_entries', record.idempotencyKey));
if (!snap.exists()) { console.error('[e2e] FAIL — doc not found after write'); exit(1); }
const d = snap.data();
console.log('[e2e] read-back OK:', JSON.stringify({
  job_id: d.job_id, machine_id: d.machine_id, worker_id: d.worker_id,
  station: d.station, qty_pcs: d.qty_pcs, app_version: d.app_version,
  author_user_id: d.author_user_id,
  created_at: d.created_at?.toDate?.()?.toISOString?.() || d.created_at,
}, null, 2));

// Idempotent replay: second send of the same record must be a silent no-op.
await transport(record);
console.log('[e2e] idempotent replay OK (no duplicate, no error)');

console.log('\n[e2e] ✅ Track 2 pipeline verified end-to-end: auth → transport → rules → Firestore → read-back');
exit(0);
