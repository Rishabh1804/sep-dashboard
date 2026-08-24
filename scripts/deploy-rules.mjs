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
// Usage: node scripts/deploy-rules.mjs [--env staging|prod] [--project <id>]
//   --env picks the credential secret AND the default project id; --project
//   still overrides the id explicitly. Defaults to staging.

import { spawnSync } from 'node:child_process';
import { env, exit } from 'node:process';
import { withCredentialFile, resolveEnv, projectFor } from './lib/admin.mjs';

const FIREBASE_TOOLS = 'firebase-tools@15.19.1'; // keep in lockstep with CI
const fbEnv = resolveEnv();
const project = projectFor(fbEnv);

const status = withCredentialFile((credPath) => {
  const r = spawnSync('npx', ['-y', FIREBASE_TOOLS, 'deploy', '--only', 'firestore:rules', '--project', project],
    { stdio: 'inherit', env: { ...env, GOOGLE_APPLICATION_CREDENTIALS: credPath } });
  return r.status ?? 1;
}, fbEnv);
exit(status);
