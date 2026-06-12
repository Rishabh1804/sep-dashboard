import {
  clearTransport,
  customersToPickerItems,
  flush,
  itemsToPickerItems,
  jobsToPickerItems,
  setCache,
  setTransport
} from "./chunk-JWRXL5EB.js";
import {
  BUILD,
  DEF_AREAS,
  DEF_STOCK
} from "./chunk-I5LOYBFW.js";
import {
  bootFirebaseSession
} from "./chunk-ZSA5E46Q.js";

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
      throw new PermanentRejection(`station '${station}' not accepted by rules`);
    }
    const rounds = f.rounds != null ? num(f.rounds) : null;
    const roundSize = f.round_size != null ? num(f.round_size) : null;
    const qty = f.quantity != null ? num(f.quantity) : rounds > 0 && roundSize > 0 ? rounds * roundSize : NaN;
    if (!(qty > 0)) {
      throw new PermanentRejection("quantity missing: need a total or rounds \xD7 round size");
    }
    const data = {
      ...envelope(record, ctx),
      job_id: f.job,
      machine_id: f.machine,
      worker_id: f.worker,
      station,
      [qtyFieldFor(f.machine)]: qty
    };
    if (rounds > 0) data.rounds = rounds;
    if (roundSize > 0) data.round_size = roundSize;
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
      received_kg: f.weight != null ? num(f.weight) : 0,
      route: "standard",
      current_status: "in-flight"
    };
    if (f.received_pcs != null) data.received_pcs = num(f.received_pcs);
    if (f.challan_no) data.challan_no = String(f.challan_no).trim();
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
    const data = {
      ...envelope(record, ctx),
      qty_received: num(f.quantity)
    };
    if (f.cost != null && num(f.cost) > 0) {
      data.unit_cost = num(f.cost);
      data.cost_unit = stockUnitFor(f.item) === "L" ? "per_liter" : "per_kg";
    }
    if (f.supplier) data.supplier_id = f.supplier;
    if (f.notes) data.notes = f.notes;
    return { path: ["stock_items", f.item, "receipts", record.idempotencyKey], data };
  },
  stock_deplete(f, record, ctx) {
    const data = {
      ...envelope(record, ctx),
      qty_depleted: num(f.quantity),
      reason: f.reason || "production_use"
    };
    if (f.level_after != null && num(f.level_after) >= 0) data.level_after = num(f.level_after);
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
    if (f.slot) data.slot = f.slot;
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
      priority: f.priority === "urgent" ? "urgent" : "normal",
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
  const session = await bootFirebaseSession();
  if (!session) return null;
  const { app, db, auth, fs, fbAuth } = session;
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
//# sourceMappingURL=firebase-boot-PFATODN4.js.map
