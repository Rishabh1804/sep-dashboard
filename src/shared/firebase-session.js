// Shared Firebase session boot — Layer 2.5 (used by both PWAs).
//
// Extracted from the handler's firebase-boot.js in Stage F so the
// dashboard's Live viewer reuses the exact provisioning path the handler
// proved live on 12 Jun: dynamic SDK imports (the Firebase chunk stays
// async + runtime-cached), offline-persistent Firestore, and the
// #token=… URL-fragment sign-in from the mint-token workflow
// (HANDLER_PROVISIONING.md — fragment, not query, so the one-shot token
// never reaches server logs).
//
// Returns null when no config exists for the resolved env — callers must
// treat that as "no Firebase" and keep their offline behaviour.

import { getFirebaseConfig } from './config/firebase.js';

// Memoised: one Firebase app per page. The dashboard now boots the session
// from two surfaces (Live tab + Edit tab); a second initializeApp() would
// throw "Firebase App named '[DEFAULT]' already exists". Caching the boot
// promise also means the one-shot #token sign-in runs exactly once. Returns
// the same {app, db, auth, fs, fbAuth} to every caller; null (no config) is
// memoised too so callers keep their offline behaviour without re-probing.
let _bootPromise;

export function bootFirebaseSession() {
  // Memoise only a SETTLED-OK boot (a resolved session, or the null no-config
  // result). A REJECTED boot — e.g. the firebase/* dynamic import failing on a
  // factory-wifi blip — must NOT be cached: clear the slot so the next call
  // retries, keeping the Live/Edit tabs' "re-open to retry" path real.
  if (_bootPromise === undefined) {
    _bootPromise = _boot().catch((err) => { _bootPromise = undefined; throw err; });
  }
  return _bootPromise;
}

async function _boot() {
  const config = getFirebaseConfig();
  if (!config) return null;

  const [{ initializeApp }, fs, fbAuth] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
    import('firebase/auth'),
  ]);

  const app = initializeApp(config);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
  const auth = fbAuth.getAuth(app);

  await signInFromUrlFragment(auth, fbAuth);

  return { app, db, auth, fs, fbAuth };
}

// One-shot provisioning token in the URL fragment. Kept in the URL on
// TRANSIENT failures (factory wifi blips during QR provisioning) so a
// reload retries — only an actually-bad token is consumed.
async function signInFromUrlFragment(auth, fbAuth) {
  const m = (globalThis.location?.hash || '').match(/[#&]token=([^&]+)/);
  if (!m) return;
  let scrub = true;
  try {
    await fbAuth.signInWithCustomToken(auth, decodeURIComponent(m[1]));
  } catch (err) {
    const code = err?.code || '';
    scrub = code === 'auth/invalid-custom-token' || code === 'auth/custom-token-mismatch'
         || code === 'auth/user-disabled';
  }
  if (scrub) {
    try {
      globalThis.history?.replaceState(null, '', globalThis.location.pathname + globalThis.location.search);
    } catch { /* ignore */ }
  }
}
