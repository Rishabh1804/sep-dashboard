// Shared plumbing for the admin scripts (seed-staging, mint-token).
// One place for CLI arg parsing and Admin-SDK credential resolution, so the
// scripts can't drift apart on env-var conventions.

import { argv, env } from 'node:process';

export function arg(name, dflt = null) {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
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
