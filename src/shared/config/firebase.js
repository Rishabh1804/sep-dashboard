// Firebase project configs — Layer 3 (static data).
//
// Web-app configs are PUBLIC identifiers (safe to commit): security comes
// from the Firestore rules (default-deny, FIRESTORE_RULES.ref.txt) plus
// App Check at Stage G — never from hiding these values.
//
// Env selection: ?fbenv=staging|prod once, persisted to localStorage.
// Defaults to staging until the prod project exists (getFirebaseConfig
// returns null for an unprovisioned env, and callers must treat null as
// "no Firebase" — the handler keeps queueing offline, honestly).

const CONFIGS = {
  staging: {
    apiKey: 'AIzaSyBkzjLbyvEzB2gZvsE8sggWN0hKShPhE8Y',
    authDomain: 'sep-dashboard-staging.firebaseapp.com',
    projectId: 'sep-dashboard-staging',
    storageBucket: 'sep-dashboard-staging.firebasestorage.app',
    messagingSenderId: '763830357487',
    appId: '1:763830357487:web:80191c6d3076de00787a1a',
  },
  prod: null, // project not created yet — same runbook as staging when ready
};

const ENV_KEY = 'sep_fb_env';
const DEFAULT_ENV = 'staging';

export function resolveFirebaseEnv() {
  let env = null;
  try {
    const m = globalThis.location?.search?.match(/[?&]fbenv=(staging|prod)\b/);
    if (m) {
      env = m[1];
      globalThis.localStorage?.setItem(ENV_KEY, env);
    } else {
      env = globalThis.localStorage?.getItem(ENV_KEY);
    }
  } catch { /* storage unavailable — fall through */ }
  return env && Object.prototype.hasOwnProperty.call(CONFIGS, env) ? env : DEFAULT_ENV;
}

export function getFirebaseConfig(env = resolveFirebaseEnv()) {
  return CONFIGS[env] || null;
}
