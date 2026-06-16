// Shared plumbing for the admin scripts (seed-staging, mint-token).
// One place for CLI arg parsing and Admin-SDK credential resolution, so the
// scripts can't drift apart on env-var conventions.

import { argv, env, exit } from 'node:process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function arg(name, dflt = null) {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
}

// firebase-tools takes credentials only as a FILE PATH (the Admin SDK above
// takes JSON). Materialize FIREBASE_SERVICE_ACCOUNT_STAGING (the CI-secret JSON
// convention) to a 0600 tempfile for the duration of `fn(credPath)`, or pass an
// existing GOOGLE_APPLICATION_CREDENTIALS path straight through. The tempfile is
// removed in `finally`, so a throw inside `fn` can't leak the key on disk.
// Shared by the deploy-rules / deploy-functions scripts so they can't drift.
export function withCredentialFile(fn) {
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
  try {
    return fn(credPath);
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

// Credentials: FIREBASE_SERVICE_ACCOUNT_STAGING (full JSON in an env var —
// the GitHub Actions secret convention) or GOOGLE_APPLICATION_CREDENTIALS
// (file path). Throws if neither is present rather than silently falling
// back to default credentials against an unintended project.
export async function initAdminApp() {
  const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  const saJson = env.FIREBASE_SERVICE_ACCOUNT_STAGING;
  if (!saJson && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('No credentials: set FIREBASE_SERVICE_ACCOUNT_STAGING (JSON) or GOOGLE_APPLICATION_CREDENTIALS (path).');
  }
  return initializeApp({ credential: saJson ? cert(JSON.parse(saJson)) : applicationDefault() });
}
