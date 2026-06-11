import {
  clearTransport,
  customersToPickerItems,
  flush,
  itemsToPickerItems,
  jobsToPickerItems,
  setCache,
  setTransport
} from "./chunk-JM3BSFQS.js";
import {
  BUILD,
  DEF_AREAS,
  DEF_STOCK
} from "./chunk-GEIU5DZV.js";

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

// src/handler/transport.js
var PermanentRejection = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PermanentRejection";
    this.permanent = true;
  }
};
var RULE_STATIONS = ["pickling", "plating", "inspection", "dispatch"];
function areaById(id) {
  return DEF_AREAS.find((a) => a.id === id) || null;
}
function qtyFieldFor(machineId) {
  const area = areaById(machineId);
  return area?.group === "barrel" ? "qty_kg" : "qty_pcs";
}
function defaultStation(machineId) {
  return areaById(machineId)?.dep ? "pickling" : "plating";
}
function stockUnitFor(itemId) {
  return DEF_STOCK.find((s) => s.id === itemId)?.unit || "kg";
}
function num(v) {
  return typeof v === "number" ? v : Number(v);
}
function envelope(record, ctx) {
  return {
    author_user_id: ctx.uid,
    created_at: ctx.serverTimestamp(),
    app_version: String(ctx.build ?? BUILD),
    client_ts: record.ts,
    idempotency_key: record.idempotencyKey
  };
}
var MAPPERS = {
  production(f, record, ctx) {
    const station = f.station || defaultStation(f.machine);
    if (!RULE_STATIONS.includes(station)) {
      throw new PermanentRejection(`station '${station}' not accepted by rules (Stage D skew)`);
    }
    const data = {
      ...envelope(record, ctx),
      job_id: f.job,
      machine_id: f.machine,
      worker_id: f.worker,
      station,
      [qtyFieldFor(f.machine)]: num(f.quantity)
    };
    if (f.part) data.item_id = f.part;
    if (f.part__label) data.part_number = f.part__label;
    if (f.notes) data.notes = f.notes;
    return { path: ["production_entries", record.idempotencyKey], data };
  },
  job_receipt(f, record, ctx) {
    const data = {
      ...envelope(record, ctx),
      __schema_version: 2,
      customer_id: f.customer,
      received_kg: num(f.weight),
      route: "standard",
      current_status: "in-flight"
    };
    if (f.notes) data.notes = f.notes;
    return { path: ["jobs", record.idempotencyKey], data };
  },
  dft(f, record, ctx) {
    const v = num(f.dft_micron);
    const derived = !f.outcome;
    const data = {
      ...envelope(record, ctx),
      job_id: f.job,
      micron_value: v,
      outcome: f.outcome || (v >= 8 && v <= 12 ? "pass" : "fail-rework")
    };
    if (derived) data.outcome_derived = true;
    if (f.notes) data.notes = f.notes;
    return { path: ["dft_measurements", record.idempotencyKey], data };
  },
  dispatch(f, record, ctx) {
    const data = { ...envelope(record, ctx), job_id: f.job };
    if (f.weight != null) data.weight_kg = num(f.weight);
    if (f.notes) data.notes = f.notes;
    return { path: ["dispatch_events", record.idempotencyKey], data };
  },
  stock_refill(f, record, ctx) {
    if (f.cost == null || !(num(f.cost) > 0) || !f.supplier) {
      throw new PermanentRejection("rules require unit_cost > 0 and supplier_id (Stage D skew)");
    }
    const data = {
      ...envelope(record, ctx),
      qty_received: num(f.quantity),
      unit_cost: num(f.cost),
      // Cost unit follows the stock item's tracked unit (DEF_STOCK): litre-
      // tracked chemistry is priced per litre, everything else per kg. A
      // per-piece tier lands with the universal stock model (Stage D+).
      cost_unit: stockUnitFor(f.item) === "L" ? "per_liter" : "per_kg",
      supplier_id: f.supplier
    };
    if (f.notes) data.notes = f.notes;
    return { path: ["stock_items", f.item, "receipts", record.idempotencyKey], data };
  },
  stock_deplete(f, record, ctx) {
    const data = {
      ...envelope(record, ctx),
      qty_depleted: num(f.quantity),
      // The form has no reason field yet; production use is the dominant
      // case on the floor (chemistry draw). Stage D adds the selector.
      reason: "production_use"
    };
    if (f.notes) data.notes = f.notes;
    return { path: ["stock_items", f.item, "depletions", record.idempotencyKey], data };
  },
  machine_state(f, record, ctx) {
    const data = { ...envelope(record, ctx), state: f.state };
    if (f.notes) data.notes = f.notes;
    return { path: ["machines", f.machine, "state_transitions", record.idempotencyKey], data };
  },
  check_in(f, record, ctx) {
    const data = { ...envelope(record, ctx), direction: f.direction };
    return { path: ["workers", f.worker, "shifts", record.idempotencyKey], data };
  },
  note(f, record, ctx) {
    const text = String(f.note_text || "").trim();
    const data = {
      ...envelope(record, ctx),
      // Rules check created_by.uid (not author_user_id) on notes.
      created_by: { uid: ctx.uid },
      summary: text.slice(0, 120),
      body: text,
      kind: f.note_kind || "general",
      status: "active",
      topic_refs: [f.note_kind || "general"]
    };
    return { path: ["notes", record.idempotencyKey], data };
  }
};
function recordToWrite(record, ctx) {
  const mapper = MAPPERS[record.type];
  if (!mapper) throw new PermanentRejection(`unknown record type '${record.type}'`);
  if (!ctx?.uid) throw new Error("not-signed-in");
  return mapper(record.fields || {}, record, ctx);
}
function createTransport({ db, auth, fs }) {
  return async (record) => {
    const user = auth.currentUser;
    if (!user) throw new Error("not-signed-in");
    const w = recordToWrite(record, { uid: user.uid, build: BUILD, serverTimestamp: fs.serverTimestamp });
    const ref = fs.doc(db, ...w.path);
    try {
      await fs.setDoc(ref, w.data);
    } catch (err) {
      if (err?.code === "permission-denied") {
        const existing = await fs.getDoc(ref).catch(() => null);
        if (existing?.exists()) return;
      }
      throw err;
    }
  };
}

// src/handler/firebase-boot.js
var PICKER_LIMIT = 250;
async function startFirebase({ onChange } = {}) {
  const config = getFirebaseConfig();
  if (!config) return null;
  const [{ initializeApp }, fs, fbAuth] = await Promise.all([
    import("./index.esm-YCKMX627.js"),
    import("./index.esm-PSUINTKR.js"),
    import("./index.esm-SEISHXRY.js")
  ]);
  const app = initializeApp(config);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
  const auth = fbAuth.getAuth(app);
  const m = (globalThis.location?.hash || "").match(/[#&]token=([^&]+)/);
  if (m) {
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
  let unsubscribers = [];
  let activeUid = null;
  fbAuth.onAuthStateChanged(auth, (user) => {
    if (user?.uid === activeUid) return;
    unsubscribers.forEach((u) => {
      try {
        u();
      } catch {
      }
    });
    unsubscribers = [];
    activeUid = user?.uid || null;
    if (user) {
      setTransport(createTransport({ db, auth, fs }));
      unsubscribers = startPickerListeners({ db, fs, onChange });
      flush().then(() => onChange?.()).catch(() => {
      });
    } else {
      clearTransport();
    }
    onChange?.();
  });
  globalThis.addEventListener?.("online", () => {
    if (auth.currentUser) flush().then(() => onChange?.()).catch(() => {
    });
  });
  return { app, db, auth };
}
function startPickerListeners({ db, fs, onChange }) {
  const q = (name) => fs.query(fs.collection(db, name), fs.limit(PICKER_LIMIT));
  const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const onErr = () => {
  };
  return [
    fs.onSnapshot(q("customers"), (s) => {
      setCache("customer", customersToPickerItems(docs(s)));
      onChange?.();
    }, onErr),
    fs.onSnapshot(q("items"), (s) => {
      setCache("part", itemsToPickerItems(docs(s)));
      onChange?.();
    }, onErr),
    fs.onSnapshot(q("jobs"), (s) => {
      setCache("job", jobsToPickerItems(docs(s)));
      onChange?.();
    }, onErr),
    fs.onSnapshot(q("suppliers"), (s) => {
      setCache("supplier", docs(s).map((d) => ({ id: d.id, primary: d.name || d.id })));
      onChange?.();
    }, onErr)
  ];
}
export {
  startFirebase
};
//# sourceMappingURL=firebase-boot-WHCS6W4H.js.map
