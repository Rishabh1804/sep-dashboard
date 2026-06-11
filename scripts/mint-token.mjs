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

function arg(name, dflt = null) {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : dflt;
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

const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const saJson = env.FIREBASE_SERVICE_ACCOUNT_STAGING;
const app = initializeApp({ credential: saJson ? cert(JSON.parse(saJson)) : applicationDefault() });

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
