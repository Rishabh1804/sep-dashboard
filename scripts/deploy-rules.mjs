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
import { argv, env, exit } from 'node:process';
import { withCredentialFile } from './lib/admin.mjs';

const FIREBASE_TOOLS = 'firebase-tools@15.19.1'; // keep in lockstep with CI
const i = argv.indexOf('--project');
const project = i > -1 ? argv[i + 1] : 'sep-dashboard-staging';

const status = withCredentialFile((credPath) => {
  const r = spawnSync('npx', ['-y', FIREBASE_TOOLS, 'deploy', '--only', 'firestore:rules', '--project', project],
    { stdio: 'inherit', env: { ...env, GOOGLE_APPLICATION_CREDENTIALS: credPath } });
  return r.status ?? 1;
});
exit(status);
