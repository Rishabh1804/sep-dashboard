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
  doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';

const rulesPath = fileURLToPath(new URL('../../docs/reference/FIRESTORE_RULES.ref.txt', import.meta.url));

let testEnv;

// Custom-claim sets for each actor the rules recognise.
const HANDLER = { roles: ['handler'], token_id: 't-handler', is_admin: false, is_steward: false };
const INSPECTOR = { roles: ['inspector'], token_id: 't-insp', is_admin: false, is_steward: false };
const OUTSIDER = { roles: ['viewer'], token_id: 't-out', is_admin: false, is_steward: false };
const ADMIN = { roles: ['handler'], token_id: 't-admin', is_admin: true, is_steward: false };
// Compromised actors for the negative-path security tests:
const REVOKED = { roles: ['handler'], token_id: 't-revoked', is_admin: false, is_steward: false };
const STALE = { roles: ['handler'], token_id: 't-stale', is_admin: false, is_steward: false };

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
    // REVOKED worker: revoked_at set → notRevoked() must deny.
    await setDoc(doc(db, 'workers', `u-${REVOKED.token_id}`), {
      active_token_id: REVOKED.token_id, revoked_at: Timestamp.fromMillis(Date.now()), name: 'revoked',
    });
    // STALE token: worker's active_token_id differs from the token's token_id
    // → activeTokenMatches() must deny (stolen-phone offline-replay defense).
    await setDoc(doc(db, 'workers', `u-${STALE.token_id}`), {
      active_token_id: 't-OLD-rotated-out', revoked_at: null, name: 'stale',
    });
    // Numeric per the 2026-06-10 buildSupported() fix (string compare was
    // lexicographic). A dedicated test below exercises the multi-digit boundary.
    await setDoc(doc(db, 'config', 'min_supported_build'), { value: 0 });
  });
});

// Seed an existing production entry (rules disabled) with a chosen created_at,
// so update-path rules (pinning + edit window) can be exercised.
async function seedEntry(id, authorUid, createdAt) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'production_entries', id), {
      author_user_id: authorUid, created_at: createdAt, app_version: '999',
      job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 100, station: 'plating',
    });
  });
}

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
    stamped('u-t-handler', { job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 150, station: 'plating' })));
});

test('spoofed author_user_id is rejected', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'production_entries', 'p2'),
    stamped('u-t-admin', { job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 150, station: 'plating' })));
});

test('non-production role cannot create a production entry', async () => {
  const db = ctxFor(OUTSIDER);
  await assertFails(setDoc(doc(db, 'production_entries', 'p3'),
    stamped('u-t-out', { job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 150, station: 'plating' })));
});

test('zero-quantity production entry is rejected', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'production_entries', 'p4'),
    stamped('u-t-handler', { job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 0, qty_kg: 0, station: 'plating' })));
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

// ---- negative-path security invariants (the marquee defenses must BLOCK) ----

test('revoked worker cannot write (notRevoked)', async () => {
  const db = ctxFor(REVOKED);
  await assertFails(setDoc(doc(db, 'production_entries', 'p-rev'),
    stamped('u-t-revoked', { job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 150, station: 'plating' })));
});

test('stale token cannot write (activeTokenMatches — stolen-phone replay)', async () => {
  const db = ctxFor(STALE);
  await assertFails(setDoc(doc(db, 'production_entries', 'p-stale'),
    stamped('u-t-stale', { job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 150, station: 'plating' })));
});

test('update rewriting author_user_id is rejected (G3 pinning)', async () => {
  const recent = Timestamp.fromMillis(Date.now());
  await seedEntry('p-pin', 'u-t-handler', recent);
  const db = ctxFor(HANDLER);
  await assertFails(updateDoc(doc(db, 'production_entries', 'p-pin'), {
    author_user_id: 'u-t-admin', created_at: recent, app_version: '999',
    job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 200, station: 'plating',
  }));
});

test('update rewriting created_at is rejected (G3 pinning, backdate defense)', async () => {
  const recent = Timestamp.fromMillis(Date.now());
  await seedEntry('p-pin2', 'u-t-handler', recent);
  const db = ctxFor(HANDLER);
  await assertFails(updateDoc(doc(db, 'production_entries', 'p-pin2'), {
    author_user_id: 'u-t-handler', created_at: Timestamp.fromMillis(Date.now() - 1000), app_version: '999',
    job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 200, station: 'plating',
  }));
});

test('edit past the 24h window is rejected (withinEditWindow)', async () => {
  const old = Timestamp.fromMillis(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
  await seedEntry('p-old', 'u-t-handler', old);
  const db = ctxFor(HANDLER);
  await assertFails(updateDoc(doc(db, 'production_entries', 'p-old'), {
    author_user_id: 'u-t-handler', created_at: old, app_version: '999',
    job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 200, station: 'plating',
  }));
});

test('in-window update with pinned author + created_at succeeds (positive contrast)', async () => {
  const recent = Timestamp.fromMillis(Date.now());
  await seedEntry('p-ok', 'u-t-handler', recent);
  const db = ctxFor(HANDLER);
  await assertSucceeds(updateDoc(doc(db, 'production_entries', 'p-ok'), {
    author_user_id: 'u-t-handler', created_at: recent, app_version: '999',
    job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 250, station: 'plating',
  }));
});

// ---- 2026-06-10 hardening regressions (code-review findings on PR #17) ----

test('job create with spoofed author_user_id is rejected (jobs authoredBySelf)', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'jobs', 'sep-spoof'),
    stamped('u-t-admin', { customer_id: 'cust-1', received_kg: 10, route: 'standard', current_status: 'in-flight' })));
});

test('DFT in-window update cannot push micron out of the 0-50 block', async () => {
  // Seed a valid DFT doc authored by the inspector, then try to corrupt it.
  const recent = Timestamp.fromMillis(Date.now());
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'dft_measurements', 'd-edit'), {
      author_user_id: 'u-t-insp', created_at: recent, app_version: '999',
      job_id: 'j1', micron_value: 10, outcome: 'pass',
    });
  });
  const db = ctxFor(INSPECTOR);
  await assertFails(updateDoc(doc(db, 'dft_measurements', 'd-edit'), {
    author_user_id: 'u-t-insp', created_at: recent, app_version: '999',
    job_id: 'j1', micron_value: 60, outcome: 'pass',
  }));
  // Contrast: a legitimate in-window correction stays allowed.
  await assertSucceeds(updateDoc(doc(db, 'dft_measurements', 'd-edit'), {
    author_user_id: 'u-t-insp', created_at: recent, app_version: '999',
    job_id: 'j1', micron_value: 11, outcome: 'pass',
  }));
});

test('buildSupported compares numerically, not lexicographically', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config', 'min_supported_build'), { value: 100 });
  });
  const db = ctxFor(HANDLER);
  // '99' >= '100' is TRUE as strings — the numeric rule must reject it.
  await assertFails(setDoc(doc(db, 'production_entries', 'p-stale-build'), {
    author_user_id: 'u-t-handler', created_at: serverTimestamp(), app_version: '99',
    job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 150, station: 'plating',
  }));
  await assertSucceeds(setDoc(doc(db, 'production_entries', 'p-fresh-build'), {
    author_user_id: 'u-t-handler', created_at: serverTimestamp(), app_version: '100',
    job_id: 'j1', machine_id: 'vat_a1', worker_id: 'w-floor-1', qty_pcs: 150, station: 'plating',
  }));
});

test('garbage received_pcs is rejected even when received_kg > 0', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'jobs', 'sep-strpcs'),
    stamped('u-t-handler', { customer_id: 'cust-1', received_kg: 10, received_pcs: '504', route: 'standard', current_status: 'in-flight' })));
  await assertFails(setDoc(doc(db, 'jobs', 'sep-negpcs'),
    stamped('u-t-handler', { customer_id: 'cust-1', received_kg: 10, received_pcs: -500, route: 'standard', current_status: 'in-flight' })));
});

test('absurd received_pcs is capped (fat-finger hard block)', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'jobs', 'sep-fatpcs'),
    stamped('u-t-handler', { customer_id: 'cust-1', received_kg: 0, received_pcs: 15000000, route: 'standard', current_status: 'in-flight' })));
});

test('item_id and client_tier_at_receipt are validated when present', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'jobs', 'sep-baditem'),
    stamped('u-t-handler', { customer_id: 'cust-1', received_kg: 10, item_id: 42, route: 'standard', current_status: 'in-flight' })));
  await assertFails(setDoc(doc(db, 'jobs', 'sep-badtier'),
    stamped('u-t-handler', { customer_id: 'cust-1', received_kg: 10, client_tier_at_receipt: 'gold', route: 'standard', current_status: 'in-flight' })));
  await assertSucceeds(setDoc(doc(db, 'jobs', 'sep-goodtier'),
    stamped('u-t-handler', { customer_id: 'cust-1', received_kg: 10, item_id: 'item-100', client_tier_at_receipt: 'tier-1', route: 'standard', current_status: 'in-flight' })));
});

test('production entry without worker attribution is rejected', async () => {
  const db = ctxFor(HANDLER);
  await assertFails(setDoc(doc(db, 'production_entries', 'p-noworker'),
    stamped('u-t-handler', { job_id: 'j1', machine_id: 'vat_a1', qty_pcs: 150, station: 'plating' })));
});

// ---- importer parity: rules must accept what the importer actually produces ----

test('every job from the synthetic-fixture import passes the jobs create rule', async () => {
  const { importInvoicingExport } = await import('../../src/shared/import/invoicing-import.js');
  const fixture = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../tests/fixtures/invoicing-sample.json', import.meta.url)), 'utf8'));
  const out = importInvoicingExport(fixture, { now: '2026-06-10T00:00:00.000Z' });
  const db = ctxFor(HANDLER);
  for (const job of out.jobs) {
    // The seed path overrides the audit stamp with live client values; the
    // document body (quantities, FKs, route, status) is pure importer output.
    // Covers both the kg-bearing (sep-2494) and NOS-only kg==0 (sep-2495) shapes.
    await assertSucceeds(setDoc(doc(db, 'jobs', job.id), {
      ...job,
      author_user_id: 'u-t-handler',
      created_at: serverTimestamp(),
      app_version: '999',
    }));
  }
});
