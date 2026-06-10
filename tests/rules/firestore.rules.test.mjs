// Firestore security-rules tests (emulator).
//
// Run via the firestore-rules workflow:
//   firebase emulators:exec --only firestore --project demo-sep "node --test"
// The emulator loads docs/reference/FIRESTORE_RULES.ref.txt (per firebase.json).
//
// Covers the load-bearing invariants from FIRESTORE_RULES.md: default-deny,
// identity attribution (authoredBySelf + no spoofing), role enforcement,
// server-only audit_events, and the v2 isValidJob fix (item_id optional;
// NOS-only job with received_kg == 0 is valid).

import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';

const rulesPath = fileURLToPath(new URL('../../docs/reference/FIRESTORE_RULES.ref.txt', import.meta.url));

let testEnv;

// Custom-claim sets for each actor the rules recognise.
const HANDLER = { roles: ['handler'], token_id: 't-handler', is_admin: false, is_steward: false };
const INSPECTOR = { roles: ['inspector'], token_id: 't-insp', is_admin: false, is_steward: false };
const OUTSIDER = { roles: ['viewer'], token_id: 't-out', is_admin: false, is_steward: false };
const ADMIN = { roles: ['handler'], token_id: 't-admin', is_admin: true, is_steward: false };

// A write that satisfies the always-on guards (server timestamp + supported build).
const stamped = (uid, extra) => ({
  author_user_id: uid,
  created_at: serverTimestamp(),
  app_version: '999',
  ...extra,
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sep',
    firestore: { rules: readFileSync(rulesPath, 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed the docs the rules read via get(): worker identity + min build.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const claims of [HANDLER, INSPECTOR, OUTSIDER, ADMIN]) {
      const uid = `u-${claims.token_id}`;
      await setDoc(doc(db, 'workers', uid), {
        active_token_id: claims.token_id, revoked_at: null, name: uid,
      });
    }
    await setDoc(doc(db, 'config', 'min_supported_build'), { value: '0' });
  });
});

function ctxFor(claims) {
  return testEnv.authenticatedContext(`u-${claims.token_id}`, claims).firestore();
}

// ---- default deny ----
test('unauthenticated read is denied (default-deny)', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'jobs', 'j1')));
});

// ---- production_entries: identity + role ----
test('handler creates a valid production entry', async () => {
  const db = ctxFor(HANDLER);
  await assertSucceeds(setDoc(doc(db, 'production_entries', 'p1'),
    stamped('u-t-handler', { job_id: 'j1', machine_id: 'vat_a1', qty_pcs: 150, station: 'plating' })));
});

test('spoofed author_user_id is rejected', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'production_entries', 'p2'),
    stamped('u-t-admin', { job_id: 'j1', machine_id: 'vat_a1', qty_pcs: 150, station: 'plating' })));
});

test('non-production role cannot create a production entry', async () => {
  const db = ctxFor(OUTSIDER);
  await assertFails(setDoc(doc(db, 'production_entries', 'p3'),
    stamped('u-t-out', { job_id: 'j1', machine_id: 'vat_a1', qty_pcs: 150, station: 'plating' })));
});

test('zero-quantity production entry is rejected', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'production_entries', 'p4'),
    stamped('u-t-handler', { job_id: 'j1', machine_id: 'vat_a1', qty_pcs: 0, qty_kg: 0, station: 'plating' })));
});

// ---- v2 isValidJob ----
test('handler creates a multi-line-style job with NO item_id (v2)', async () => {
  const db = ctxFor(HANDLER);
  await assertSucceeds(setDoc(doc(db, 'jobs', 'sep-2494'),
    stamped('u-t-handler', { customer_id: 'cust-1', received_kg: 50.2, received_pcs: 504, route: 'standard', current_status: 'in-flight' })));
});

test('NOS-only job with received_kg == 0 is valid (v2 fix)', async () => {
  const db = ctxFor(HANDLER);
  await assertSucceeds(setDoc(doc(db, 'jobs', 'sep-2495'),
    stamped('u-t-handler', { customer_id: 'cust-2', received_kg: 0, received_pcs: 1500, route: 'standard', current_status: 'in-flight' })));
});

test('job with neither kg nor pcs is rejected', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'jobs', 'sep-bad'),
    stamped('u-t-handler', { customer_id: 'cust-2', received_kg: 0, route: 'standard', current_status: 'in-flight' })));
});

test('job missing customer_id is rejected', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'jobs', 'sep-nocust'),
    stamped('u-t-handler', { received_kg: 10, route: 'standard', current_status: 'in-flight' })));
});

// ---- dft: inspector role ----
test('inspector records a valid DFT measurement; out-of-range rejected', async () => {
  const ok = ctxFor(INSPECTOR);
  await assertSucceeds(setDoc(doc(ok, 'dft_measurements', 'd1'),
    stamped('u-t-insp', { job_id: 'j1', micron_value: 10, outcome: 'pass' })));
  const bad = ctxFor(INSPECTOR);
  await assertFails(setDoc(doc(bad, 'dft_measurements', 'd2'),
    stamped('u-t-insp', { job_id: 'j1', micron_value: 60, outcome: 'pass' })));
});

// ---- server-only collections ----
test('audit_events are not client-writable (server-only)', async () => {
  const db = ctxFor(ADMIN); // even admin clients cannot write audit_events
  await assertFails(setDoc(doc(db, 'audit_events', 'a1'),
    { entity_type: 'job', action: 'create', recorded_at: serverTimestamp() }));
});
