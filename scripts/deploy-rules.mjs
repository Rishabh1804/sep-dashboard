#!/usr/bin/env node
// Deploy the hardened Firestore rules (docs/reference/FIRESTORE_RULES.ref.txt,
// via firebase.json) to a live project with service-account credentials.
//
// firebase-tools only takes credentials as a file path, so if the key arrives
// as FIREBASE_SERVICE_ACCOUNT_STAGING (JSON env var — the cloud-env secret
// convention) it is materialized to a 0600 temp file for the duration of the
// deploy and removed after. Pinned to the same firebase-tools version as the
// rules CI workflow (.github/workflows/firestore-rules.yml).
//
// Usage: node scripts/deploy-rules.mjs [--project sep-dashboard-staging]

import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, env, exit } from 'node:process';

const FIREBASE_TOOLS = 'firebase-tools@15.19.1'; // keep in lockstep with CI
const i = argv.indexOf('--project');
const project = i > -1 ? argv[i + 1] : 'sep-dashboard-staging';

let credPath = env.GOOGLE_APPLICATION_CREDENTIALS || null;
let tmp = null;
if (!credPath && env.FIREBASE_SERVICE_ACCOUNT_STAGING) {
  tmp = mkdtempSync(join(tmpdir(), 'sep-sa-'));
  credPath = join(tmp, 'sa.json');
  writeFileSync(credPath, env.FIREBASE_SERVICE_ACCOUNT_STAGING, { mode: 0o600 });
}
if (!credPath) {
  console.error('No credentials: set FIREBASE_SERVICE_ACCOUNT_STAGING (JSON) or GOOGLE_APPLICATION_CREDENTIALS (path).');
  exit(2);
}

const r = spawnSync('npx', ['-y', FIREBASE_TOOLS, 'deploy', '--only', 'firestore:rules', '--project', project],
  { stdio: 'inherit', env: { ...env, GOOGLE_APPLICATION_CREDENTIALS: credPath } });

if (tmp) rmSync(tmp, { recursive: true, force: true });
exit(r.status ?? 1);
