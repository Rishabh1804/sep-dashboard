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

// --- environment selection (staging | prod) -------------------------------
// One service-account secret PER PROJECT: FIREBASE_SERVICE_ACCOUNT_STAGING and
// FIREBASE_SERVICE_ACCOUNT_PROD. Selected by --env / SEP_FB_ENV, defaulting to
// staging — so every existing call site, workflow step and CI job behaves
// exactly as before this switch existed.
//
// The two credentials are deliberately never interchangeable: a script that
// silently fell back from prod to the staging key would report success against
// the wrong project, which is the one failure mode worth designing out.
export const FB_ENVS = ['staging', 'prod'];
export const PROJECT_IDS = {
  staging: 'sep-dashboard-staging',
  prod: 'sep-dashboard-prod',
};

export function resolveEnv(dflt = 'staging') {
  const raw = arg('env', env.SEP_FB_ENV || dflt);
  if (!FB_ENVS.includes(raw)) {
    console.error(`Unknown --env '${raw}'. Expected one of: ${FB_ENVS.join(', ')}.`);
    exit(2);
  }
  return raw;
}

export function credentialVarFor(fbEnv) {
  return `FIREBASE_SERVICE_ACCOUNT_${fbEnv.toUpperCase()}`;
}

export function projectFor(fbEnv) {
  return arg('project', PROJECT_IDS[fbEnv]);
}

// firebase-tools takes credentials only as a FILE PATH (the Admin SDK above
// takes JSON). Materialize FIREBASE_SERVICE_ACCOUNT_STAGING (the CI-secret JSON
// convention) to a 0600 tempfile for the duration of `fn(credPath)`, or pass an
// existing GOOGLE_APPLICATION_CREDENTIALS path straight through. The tempfile is
// removed in `finally`, so a throw inside `fn` can't leak the key on disk.
// Shared by the deploy-rules / deploy-functions scripts so they can't drift.
export function withCredentialFile(fn, fbEnv = resolveEnv()) {
  const varName = credentialVarFor(fbEnv);
  let credPath = env.GOOGLE_APPLICATION_CREDENTIALS || null;
  let tmp = null;
  if (!credPath && env[varName]) {
    tmp = mkdtempSync(join(tmpdir(), 'sep-sa-'));
    credPath = join(tmp, 'sa.json');
    writeFileSync(credPath, env[varName], { mode: 0o600 });
  }
  if (!credPath) {
    console.error(`No credentials for '${fbEnv}': set ${varName} (JSON) or GOOGLE_APPLICATION_CREDENTIALS (path).`);
    exit(2);
  }
  try {
    return fn(credPath);
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

// Credentials: FIREBASE_SERVICE_ACCOUNT_<ENV> (full JSON in an env var — the
// GitHub Actions secret convention) or GOOGLE_APPLICATION_CREDENTIALS (file
// path). Throws if neither is present rather than silently falling back to
// default credentials against an unintended project.
export async function initAdminApp(fbEnv = resolveEnv()) {
  const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  const varName = credentialVarFor(fbEnv);
  const saJson = env[varName];
  if (!saJson && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(`No credentials for '${fbEnv}': set ${varName} (JSON) or GOOGLE_APPLICATION_CREDENTIALS (path).`);
  }
  return initializeApp({ credential: saJson ? cert(JSON.parse(saJson)) : applicationDefault() });
}
