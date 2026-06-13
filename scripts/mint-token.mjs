#!/usr/bin/env node
// Mint a Firebase custom token for a worker — the manual stand-in for the
// provisionWorker Cloud Function (functions/README.md, not yet deployed).
// Used to provision the first handler devices and to smoke-test the live
// transport. Creates/updates the workers/{uid} doc so notRevoked() and
// activeTokenMatches() pass, then prints the token and the #token= URL the
// handler PWA signs in with (QR-encode the URL for in-person provisioning).
//
// Credentials: FIREBASE_SERVICE_ACCOUNT_STAGING (JSON env var) or
// GOOGLE_APPLICATION_CREDENTIALS (file path).
//
// Usage:
//   node scripts/mint-token.mjs --uid champai --name "Champai" --roles handler
//   node scripts/mint-token.mjs --uid rishabh --name "Rishabh" --roles handler --admin

import { argv, env, exit } from 'node:process';
import { randomUUID } from 'node:crypto';
import { arg, initAdminApp } from './lib/admin.mjs';

// Defense at the tool, not just the workflow wrapper: this script prints a
// live sign-in token, and CI run logs on a public repo are world-readable.
// Any CI invocation must explicitly assert log privacy was verified — the
// firebase-admin workflow sets MINT_ALLOW_CI_LOGS=1 only after its
// public-repo guard passes. Local runs are unaffected.
if (env.GITHUB_ACTIONS === 'true' && env.MINT_ALLOW_CI_LOGS !== '1') {
  console.error('[mint] refusing to print a live token in CI without MINT_ALLOW_CI_LOGS=1 '
    + '(set only after verifying run logs are private). Run locally instead.');
  exit(1);
}

const uid = arg('uid');
const name = arg('name', uid);
const roles = (arg('roles', 'handler') || '').split(',').map((s) => s.trim()).filter(Boolean);
const isAdmin = argv.includes('--admin');
const isSteward = argv.includes('--steward');
if (!uid) {
  console.error('Usage: node scripts/mint-token.mjs --uid <id> [--name <name>] [--roles handler,pickler] [--admin] [--steward]');
  exit(2);
}

const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = await initAdminApp();

const tokenId = `t-${randomUUID().slice(0, 8)}`;
const claims = { roles, token_id: tokenId, is_admin: isAdmin, is_steward: isSteward };

// Rules read workers/{uid}.active_token_id + revoked_at on every write.
await getFirestore(app).collection('workers').doc(uid).set({
  name,
  roles,
  active_token_id: tokenId,
  token_reissued_at: FieldValue.serverTimestamp(),
  revoked_at: null,
}, { merge: true });

const token = await getAuth(app).createCustomToken(uid, claims);
console.log(`[mint] worker doc upserted: workers/${uid} (active_token_id=${tokenId})`);
console.log(`[mint] claims: ${JSON.stringify(claims)}`);
console.log('\n--- custom token (valid 1h; the signed-in session persists on-device) ---\n');
console.log(token);
console.log('\n--- handler sign-in URL (open on the device / QR-encode it) ---\n');
console.log(`https://rishabh1804.github.io/sep-dashboard/entry/handler/#token=${encodeURIComponent(token)}`);
