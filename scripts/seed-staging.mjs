#!/usr/bin/env node
// Track 2 import runner — seeds a live Firestore project from a sep-invoicing
// JSON export via the Admin SDK (client writes would fail the rules by design).
//
// Pipeline: read export → importInvoicingExport() (pure, Track 1) →
// validateImportOutput() (Zod) → ABORT on any failure or challan-no collision
// → batched writes → seed config/min_supported_build → summary.
//
// Credentials (either):
//   FIREBASE_SERVICE_ACCOUNT_STAGING — full service-account JSON in an env var
//   GOOGLE_APPLICATION_CREDENTIALS   — path to the JSON file
//
// Usage:
//   node scripts/seed-staging.mjs --export path/to/invoicing-backup.json [--dry-run]
//   node scripts/seed-staging.mjs --export tests/fixtures/invoicing-sample.json --dry-run

import { readFileSync } from 'node:fs';
import { argv, env, exit } from 'node:process';
import { importInvoicingExport } from '../src/shared/import/invoicing-import.js';
import { validateImportOutput } from '../src/shared/types/schemas.js';
import { BUILD } from '../src/shared/config/app.js';

function arg(name) {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : null;
}
const DRY = argv.includes('--dry-run');
const exportPath = arg('export');
if (!exportPath) {
  console.error('Usage: node scripts/seed-staging.mjs --export <invoicing-backup.json> [--dry-run]');
  exit(2);
}

// --- Transform + validate (no credentials needed; dry-run stops here) ---
const exportJson = JSON.parse(readFileSync(exportPath, 'utf8'));
const out = importInvoicingExport(exportJson);
const { customers, items, jobs, jobLines, stats } = out;

console.log(`[seed] transformed: ${customers.length} customers · ${items.length} items · ${jobs.length} jobs · ${jobLines.length} job lines`);
if (stats?.jobIdCollisions?.length) {
  console.error(`[seed] ABORT — ${stats.jobIdCollisions.length} challan-number collisions:`, stats.jobIdCollisions.slice(0, 10));
  exit(1);
}
const v = validateImportOutput(out);
if (!v.ok) {
  console.error(`[seed] ABORT — ${v.failures.length} Zod validation failures (first 5):`);
  for (const f of v.failures.slice(0, 5)) console.error(`  ${f.collection}[${f.index}] id=${f.id}:`, f.issues.map((i) => i.message).join('; '));
  exit(1);
}
console.log('[seed] Zod validation: all green');
if (DRY) { console.log('[seed] dry-run — no writes performed'); exit(0); }

// --- Admin SDK writes ---
const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const saJson = env.FIREBASE_SERVICE_ACCOUNT_STAGING;
const app = initializeApp({
  credential: saJson ? cert(JSON.parse(saJson)) : applicationDefault(),
});
const db = getFirestore(app);
console.log(`[seed] project: ${app.options.credential?.projectId || env.GOOGLE_CLOUD_PROJECT || '(from credential)'}`);

const BATCH_LIMIT = 500;
let written = 0;
let batch = db.batch();
let inBatch = 0;
async function put(ref, data) {
  batch.set(ref, { ...data, imported_at: FieldValue.serverTimestamp() });
  written += 1; inBatch += 1;
  if (inBatch >= BATCH_LIMIT) { await batch.commit(); batch = db.batch(); inBatch = 0; }
}

for (const c of customers) await put(db.collection('customers').doc(c.id), c);
for (const it of items) await put(db.collection('items').doc(it.id), it);
for (const j of jobs) await put(db.collection('jobs').doc(j.id), j);
for (const l of jobLines) await put(db.collection('jobs').doc(l.job_id).collection('job_lines').doc(l.id), l);

// buildSupported() reads this on every client write — must exist before any
// handler can sync (rules fail closed on a missing doc).
await put(db.collection('config').doc('min_supported_build'), { value: BUILD });

if (inBatch > 0) await batch.commit();
console.log(`[seed] done — ${written} documents written (incl. config/min_supported_build = ${BUILD})`);
