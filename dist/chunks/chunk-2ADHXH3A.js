// src/shared/config/firebase.js
var CONFIGS = {
  staging: {
    apiKey: "AIzaSyBkzjLbyvEzB2gZvsE8sggWN0hKShPhE8Y",
    authDomain: "sep-dashboard-staging.firebaseapp.com",
    projectId: "sep-dashboard-staging",
    storageBucket: "sep-dashboard-staging.firebasestorage.app",
    messagingSenderId: "763830357487",
    appId: "1:763830357487:web:80191c6d3076de00787a1a"
  },
  prod: null
  // project not created yet — same runbook as staging when ready
};
var ENV_KEY = "sep_fb_env";
var DEFAULT_ENV = "staging";
function resolveFirebaseEnv() {
  let env = null;
  try {
    const m = globalThis.location?.search?.match(/[?&]fbenv=(staging|prod)\b/);
    if (m && CONFIGS[m[1]]) {
      env = m[1];
      globalThis.localStorage?.setItem(ENV_KEY, env);
    } else {
      env = globalThis.localStorage?.getItem(ENV_KEY);
    }
  } catch {
  }
  return env && CONFIGS[env] ? env : DEFAULT_ENV;
}
function getFirebaseConfig(env = resolveFirebaseEnv()) {
  return CONFIGS[env] || null;
}

// src/shared/firebase-session.js
var _bootPromise;
function bootFirebaseSession() {
  if (_bootPromise === void 0) {
    _bootPromise = _boot().catch((err) => {
      _bootPromise = void 0;
      throw err;
    });
  }
  return _bootPromise;
}
async function _boot() {
  const config = getFirebaseConfig();
  if (!config) return null;
  const [{ initializeApp }, fs, fbAuth] = await Promise.all([
    import("./index.esm-OHGUEI4Y.js"),
    import("./index.esm-KA5UU77X.js"),
    import("./index.esm-VBHEN4HA.js")
  ]);
  const app = initializeApp(config);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
  const auth = fbAuth.getAuth(app);
  await signInFromUrlFragment(auth, fbAuth);
  return { app, db, auth, fs, fbAuth };
}
async function signInFromUrlFragment(auth, fbAuth) {
  const m = (globalThis.location?.hash || "").match(/[#&]token=([^&]+)/);
  if (!m) return;
  let scrub = true;
  try {
    await fbAuth.signInWithCustomToken(auth, decodeURIComponent(m[1]));
  } catch (err) {
    const code = err?.code || "";
    scrub = code === "auth/invalid-custom-token" || code === "auth/custom-token-mismatch" || code === "auth/user-disabled";
  }
  if (scrub) {
    try {
      globalThis.history?.replaceState(null, "", globalThis.location.pathname + globalThis.location.search);
    } catch {
    }
  }
}

export {
  bootFirebaseSession
};
//# sourceMappingURL=chunk-2ADHXH3A.js.map
