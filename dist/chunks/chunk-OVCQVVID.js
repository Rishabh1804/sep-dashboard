// src/handler/i18n.js
var LANG_KEY = "sep_handler_lang";
var LANGS = ["hi", "en"];
var DICT = {
  // App / shell
  app_title: { hi: "\u090F\u0938\u0908\u092A\u0940 \u0939\u0948\u0902\u0921\u0932\u0930", en: "SEP Handler" },
  home: { hi: "\u0939\u094B\u092E", en: "Home" },
  recent_entries: { hi: "\u0939\u093E\u0932 \u0915\u0940 \u090F\u0902\u091F\u094D\u0930\u0940", en: "Recent entries" },
  no_recent: { hi: "\u0905\u092D\u0940 \u0915\u094B\u0908 \u090F\u0902\u091F\u094D\u0930\u0940 \u0928\u0939\u0940\u0902", en: "No entries yet" },
  settings: { hi: "\u0938\u0947\u091F\u093F\u0902\u0917", en: "Settings" },
  language: { hi: "\u092D\u093E\u0937\u093E", en: "Language" },
  sound: { hi: "\u0906\u0935\u093E\u091C\u093C", en: "Sound" },
  handler_name: { hi: "\u0906\u092A\u0915\u093E \u0928\u093E\u092E", en: "Your name" },
  shift: { hi: "\u0936\u093F\u092B\u094D\u091F", en: "Shift" },
  shift_m: { hi: "\u0938\u0941\u092C\u0939", en: "Morning" },
  shift_s: { hi: "\u0926\u093F\u0928", en: "Standard" },
  shift_e: { hi: "\u0936\u093E\u092E", en: "Evening" },
  // Sync chip / queue
  synced: { hi: "\u0938\u092C \u0938\u0947\u0935 \u0939\u094B \u0917\u092F\u093E", en: "All synced" },
  syncing: { hi: "\u092D\u0947\u091C \u0930\u0939\u0947 \u0939\u0948\u0902", en: "Syncing" },
  offline_saved: { hi: "\u092B\u093C\u094B\u0928 \u092E\u0947\u0902 \u0938\u0947\u0935, \u0905\u092D\u0940 \u092D\u0947\u091C\u093E \u0928\u0939\u0940\u0902", en: "Saved on phone, not yet sent" },
  not_sent: { hi: "\u092D\u0947\u091C\u093E \u0928\u0939\u0940\u0902", en: "Not sent" },
  rejected: { hi: "\u0938\u0930\u094D\u0935\u0930 \u0928\u0947 \u092E\u0928\u093E \u0915\u093F\u092F\u093E", en: "Rejected by server" },
  discard_rejected: { hi: "\u092E\u0928\u093E \u0915\u093F\u090F \u0939\u0941\u090F \u0939\u091F\u093E\u090F\u0902", en: "Discard rejected" },
  requeue_rejected: { hi: "\u092B\u093F\u0930 \u0938\u0947 \u092D\u0947\u091C\u0947\u0902", en: "Retry rejected" },
  sync_status: { hi: "\u0938\u093F\u0902\u0915 \u0938\u094D\u0925\u093F\u0924\u093F", en: "Sync status" },
  sync_now: { hi: "\u0905\u092D\u0940 \u092D\u0947\u091C\u0947\u0902", en: "Sync now" },
  hold: { hi: "\u0930\u0941\u0915\u0947\u0902", en: "Hold" },
  review: { hi: "\u0926\u0947\u0916\u0947\u0902", en: "Review" },
  last_sync: { hi: "\u092A\u093F\u091B\u0932\u0940 \u092C\u093E\u0930 \u092D\u0947\u091C\u093E", en: "Last sync" },
  network: { hi: "\u0928\u0947\u091F\u0935\u0930\u094D\u0915", en: "Network" },
  online: { hi: "\u091A\u093E\u0932\u0942", en: "online" },
  offline: { hi: "\u092C\u0902\u0926", en: "offline" },
  pending_sync: { hi: "\u092D\u0947\u091C\u0928\u093E \u092C\u093E\u0915\u0940", en: "pending sync" },
  pending_since: { hi: "\u0915\u092C \u0938\u0947", en: "Since" },
  // Form names (tiles)
  job_receipt: { hi: "\u092E\u093E\u0932 \u0906\u092F\u093E", en: "Job receipt" },
  production: { hi: "\u092A\u094D\u0930\u094B\u0921\u0915\u094D\u0936\u0928", en: "Production" },
  dft: { hi: "\u0921\u0940\u090F\u092B\u091F\u0940 \u092E\u093E\u092A", en: "DFT measure" },
  dispatch: { hi: "\u092E\u093E\u0932 \u092D\u0947\u091C\u093E", en: "Dispatch" },
  stock_refill: { hi: "\u0938\u094D\u091F\u0949\u0915 \u0906\u092F\u093E", en: "Stock refill" },
  stock_deplete: { hi: "\u0938\u094D\u091F\u0949\u0915 \u0916\u0930\u094D\u091A", en: "Stock used" },
  machine_state: { hi: "\u092E\u0936\u0940\u0928 \u0938\u094D\u0925\u093F\u0924\u093F", en: "Machine state" },
  check_in: { hi: "\u0939\u093E\u091C\u093C\u093F\u0930\u0940", en: "Check in/out" },
  note: { hi: "\u0928\u094B\u091F", en: "Note" },
  // Field labels
  f_job: { hi: "\u091C\u0949\u092C", en: "Job" },
  f_part: { hi: "\u092A\u093E\u0930\u094D\u091F / SKU", en: "Part / SKU" },
  f_machine: { hi: "\u092E\u0936\u0940\u0928", en: "Machine" },
  f_worker: { hi: "\u0915\u093E\u0930\u0940\u0917\u0930", en: "Worker" },
  f_quantity: { hi: "\u092E\u093E\u0924\u094D\u0930\u093E", en: "Quantity" },
  f_station: { hi: "\u0938\u094D\u091F\u0947\u0936\u0928", en: "Station" },
  f_notes: { hi: "\u0928\u094B\u091F (\u0935\u0948\u0915\u0932\u094D\u092A\u093F\u0915)", en: "Notes (optional)" },
  f_customer: { hi: "\u0917\u094D\u0930\u093E\u0939\u0915", en: "Customer" },
  f_weight: { hi: "\u0935\u091C\u093C\u0928 (\u0915\u093F\u0917\u094D\u0930\u093E)", en: "Weight (kg)" },
  f_dft_micron: { hi: "\u0921\u0940\u090F\u092B\u091F\u0940 (\u092E\u093E\u0907\u0915\u094D\u0930\u094B\u0928)", en: "DFT (micron)" },
  f_outcome: { hi: "\u0928\u0924\u0940\u091C\u093E", en: "Outcome" },
  f_item: { hi: "\u0938\u093E\u092E\u093E\u0928", en: "Item" },
  f_supplier: { hi: "\u0938\u092A\u094D\u0932\u093E\u092F\u0930", en: "Supplier" },
  f_cost: { hi: "\u0915\u0940\u092E\u0924 (\u20B9)", en: "Cost (\u20B9)" },
  f_state: { hi: "\u0938\u094D\u0925\u093F\u0924\u093F", en: "State" },
  f_direction: { hi: "\u0906\u0928\u093E/\u091C\u093E\u0928\u093E", en: "In / Out" },
  f_note_text: { hi: "\u0915\u094D\u092F\u093E \u0932\u093F\u0916\u0928\u093E \u0939\u0948", en: "What to note" },
  f_note_kind: { hi: "\u0915\u093F\u0938 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902", en: "About" },
  f_self: { hi: "\u0916\u0941\u0926", en: "self" },
  f_rounds: { hi: "\u0930\u093E\u0909\u0902\u0921 (\u0935\u0948\u0915\u0932\u094D\u092A\u093F\u0915)", en: "Rounds (optional)" },
  f_round_size: { hi: "\u0939\u0930 \u0930\u093E\u0909\u0902\u0921 \u092E\u0947\u0902 \u0915\u093F\u0924\u0928\u093E", en: "Per-round count" },
  f_challan: { hi: "\u091A\u093E\u0932\u093E\u0928 \u0928\u0902\u092C\u0930", en: "Challan no." },
  f_pcs: { hi: "\u092A\u0940\u0938 (NOS)", en: "Pieces (NOS)" },
  f_reason: { hi: "\u0915\u093E\u0930\u0923", en: "Reason" },
  f_level_after: { hi: "\u0905\u092C \u0915\u093F\u0924\u0928\u093E \u092C\u091A\u093E", en: "Level left after" },
  f_slot: { hi: "\u0915\u094C\u0928 \u0938\u0940 \u092A\u093E\u0930\u0940", en: "Slot" },
  f_priority: { hi: "\u0915\u093F\u0924\u0928\u093E \u091C\u093C\u0930\u0942\u0930\u0940", en: "Priority" },
  // Station / state option values
  opt_pickling: { hi: "\u092A\u093F\u0915\u0932\u093F\u0902\u0917", en: "Pickling" },
  opt_plating: { hi: "\u092A\u094D\u0932\u0947\u091F\u093F\u0902\u0917", en: "Plating" },
  opt_passivation: { hi: "\u092A\u0948\u0938\u093F\u0935\u0947\u0936\u0928", en: "Passivation" },
  opt_inspection: { hi: "\u091C\u093E\u0901\u091A", en: "Inspection" },
  opt_running: { hi: "\u091A\u093E\u0932\u0942", en: "Running" },
  opt_idle: { hi: "\u0916\u093E\u0932\u0940", en: "Idle" },
  opt_down: { hi: "\u0916\u0930\u093E\u092C", en: "Down" },
  opt_in: { hi: "\u0906\u0928\u093E", en: "In" },
  opt_out: { hi: "\u091C\u093E\u0928\u093E", en: "Out" },
  opt_pass: { hi: "\u092A\u093E\u0938", en: "Pass" },
  opt_fail_rework: { hi: "\u092B\u0947\u0932 \u2014 \u0926\u094B\u092C\u093E\u0930\u093E", en: "Fail \u2014 rework" },
  opt_morning_ot: { hi: "\u0938\u0941\u092C\u0939 \u0913\u091F\u0940 (6 \u092C\u091C\u0947)", en: "Morning OT (6 AM)" },
  opt_regular: { hi: "\u0926\u093F\u0928 \u0915\u0940 \u092A\u093E\u0930\u0940", en: "Regular shift" },
  opt_evening_ot: { hi: "\u0936\u093E\u092E \u0913\u091F\u0940 (5 \u092C\u091C\u0947 \u092C\u093E\u0926)", en: "Evening OT (post-5)" },
  opt_use: { hi: "\u0915\u093E\u092E \u092E\u0947\u0902 \u0932\u0917\u093E", en: "Production use" },
  opt_waste: { hi: "\u092C\u0930\u094D\u092C\u093E\u0926", en: "Waste" },
  opt_spill: { hi: "\u0917\u093F\u0930 \u0917\u092F\u093E", en: "Spillage" },
  opt_theft: { hi: "\u091A\u094B\u0930\u0940", en: "Theft" },
  opt_other: { hi: "\u0914\u0930 \u0915\u0941\u091B", en: "Other" },
  opt_normal: { hi: "\u0938\u093E\u092E\u093E\u0928\u094D\u092F", en: "Normal" },
  opt_urgent: { hi: "\u091C\u093C\u0930\u0942\u0930\u0940", en: "Urgent" },
  opt_power_cut: { hi: "\u092C\u093F\u091C\u0932\u0940 \u0915\u091F\u0940", en: "Power cut" },
  opt_incident: { hi: "\u0918\u091F\u0928\u093E", en: "Incident" },
  // Actions / dialogs
  back: { hi: "\u0935\u093E\u092A\u0938", en: "Back" },
  cancel: { hi: "\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902", en: "Cancel" },
  submit_continue: { hi: "\u0938\u0947\u0935 \u0915\u0930\u0947\u0902 \u0914\u0930 \u0906\u0917\u0947", en: "Submit & continue" },
  submit_return: { hi: "\u0938\u0947\u0935 \u0915\u0930\u0947\u0902", en: "Submit" },
  change: { hi: "\u092C\u0926\u0932\u0947\u0902", en: "Change" },
  choose: { hi: "\u091A\u0941\u0928\u0947\u0902", en: "Choose\u2026" },
  search_more: { hi: "\u0914\u0930 \u0916\u094B\u091C\u0947\u0902", en: "Search more" },
  saved: { hi: "\u0938\u0947\u0935 \u0939\u094B \u0917\u092F\u093E", en: "Saved" },
  required: { hi: "\u092F\u0939 \u091C\u093C\u0930\u0942\u0930\u0940 \u0939\u0948", en: "This is required" },
  resume_q: { hi: "\u092A\u093F\u091B\u0932\u0940 \u090F\u0902\u091F\u094D\u0930\u0940 \u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902?", en: "Resume previous entry?" },
  yes: { hi: "\u0939\u093E\u0901", en: "Yes" },
  no: { hi: "\u0928\u0939\u0940\u0902", en: "No" },
  still_same: { hi: "\u0905\u092C \u092D\u0940 \u092F\u0939\u0940?", en: "Still this?" },
  stage_d_note: { hi: "\u092A\u0942\u0930\u0947 \u092B\u093C\u0940\u0932\u094D\u0921 \u0938\u094D\u091F\u0947\u091C D \u092E\u0947\u0902 \u0906\u090F\u0901\u0917\u0947", en: "Full fields land in Stage D" },
  // Sanity / σ-net confirm (form.js)
  unusual_title: { hi: "\u092F\u0939 \u0905\u0938\u093E\u092E\u093E\u0928\u094D\u092F \u0932\u0917\u0924\u093E \u0939\u0948", en: "This looks unusual" },
  unusual_ask: { hi: "\u0915\u094D\u092F\u093E \u092F\u0947 \u0928\u0902\u092C\u0930 \u0938\u0939\u0940 \u0939\u0948\u0902?", en: "Are these numbers correct?" },
  confirm_correct: { hi: "\u0939\u093E\u0901, \u0938\u0939\u0940 \u0939\u0948", en: "Yes, it's correct" },
  go_fix: { hi: "\u092C\u0926\u0932\u0947\u0902", en: "Go back & fix" }
};
var current = readInitialLang();
function readInitialLang() {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch {
  }
  return "hi";
}
function getLang() {
  return current;
}
function setLang(lang) {
  if (!LANGS.includes(lang)) return current;
  current = lang;
  try {
    globalThis.localStorage?.setItem(LANG_KEY, lang);
  } catch {
  }
  return current;
}
function t(key, lang = current) {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en ?? key;
}
function speak(key) {
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof globalThis.SpeechSynthesisUtterance === "undefined") return false;
  const text = t(key, "hi");
  const u = new globalThis.SpeechSynthesisUtterance(text);
  u.lang = "hi-IN";
  const hindiVoice = synth.getVoices?.().find((v) => v.lang?.startsWith("hi"));
  if (hindiVoice) u.voice = hindiVoice;
  synth.cancel();
  synth.speak(u);
  return true;
}

// src/handler/idb.js
var DB_NAME = "sep-handler";
var STORE = "kv";
var VERSION = 1;
var dbPromise = null;
function idbAvailable() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function tx(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t2 = db.transaction(STORE, mode);
    const store = t2.objectStore(STORE);
    const out = fn(store);
    t2.oncomplete = () => resolve(out.value);
    t2.onerror = () => reject(t2.error);
    t2.onabort = () => reject(t2.error);
  }));
}
function idbGet(key) {
  return tx("readonly", (store) => {
    const box = { value: void 0 };
    store.get(key).onsuccess = (e) => {
      box.value = e.target.result;
    };
    return box;
  });
}
function idbSet(key, val) {
  return tx("readwrite", (store) => {
    store.put(val, key);
    return { value: val };
  });
}
function idbDel(key) {
  return tx("readwrite", (store) => {
    store.delete(key);
    return { value: void 0 };
  });
}
function idbScan(prefix) {
  return tx("readonly", (store) => {
    const box = { value: [] };
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
        box.value.push({ key: cursor.key, value: cursor.value });
      }
      cursor.continue();
    };
    return box;
  });
}

// src/handler/recent.js
var RECENT_KEY = "recent_entries";
var MAX = 10;
var cache = [];
async function loadRecent() {
  if (!idbAvailable()) return cache;
  const stored = await idbGet(RECENT_KEY).catch(() => null);
  cache = Array.isArray(stored) ? stored : [];
  return cache;
}
function getRecent() {
  return cache;
}
async function pushRecent(entry) {
  cache = [entry, ...cache].slice(0, MAX);
  if (idbAvailable()) await idbSet(RECENT_KEY, cache).catch(() => {
  });
  return cache;
}
async function markRecentSynced(idempotencyKeys) {
  return markStatus(idempotencyKeys, "synced");
}
async function markRecentRejected(idempotencyKeys) {
  return markStatus(idempotencyKeys, "rejected");
}
async function markStatus(idempotencyKeys, status) {
  const set = new Set(idempotencyKeys);
  let changed = false;
  cache = cache.map((e) => {
    if (e.status === "queued" && set.has(e.idempotencyKey)) {
      changed = true;
      return { ...e, status };
    }
    return e;
  });
  if (changed && idbAvailable()) await idbSet(RECENT_KEY, cache).catch(() => {
  });
  return cache;
}

// src/handler/sync.js
var QUEUE_PREFIX = "queue:";
var REJECTED_PREFIX = "rejected:";
var LAST_SYNC_KEY = "sep_handler_last_sync";
var held = false;
var NO_TRANSPORT = async () => {
  throw new Error("no-transport");
};
var transport = NO_TRANSPORT;
var transportReady = false;
function setTransport(fn) {
  transport = fn;
  transportReady = true;
}
function clearTransport() {
  transport = NO_TRANSPORT;
  transportReady = false;
}
async function enqueueWrite(record) {
  const key = `${QUEUE_PREFIX}${record.ts}:${record.idempotencyKey}`;
  if (idbAvailable()) await idbSet(key, record).catch(() => {
  });
  return key;
}
async function listQueue() {
  if (!idbAvailable()) return [];
  const rows = await idbScan(QUEUE_PREFIX).catch(() => []);
  return rows.map((r) => ({ key: r.key, record: r.value })).sort((a, b) => (a.record.ts || 0) - (b.record.ts || 0));
}
async function queueCount() {
  return (await listQueue()).length;
}
async function listRejected() {
  if (!idbAvailable()) return [];
  const rows = await idbScan(REJECTED_PREFIX).catch(() => []);
  return rows.map((r) => ({ key: r.key, ...r.value }));
}
async function rejectedCount() {
  return (await listRejected()).length;
}
async function discardRejected() {
  const rows = await listRejected();
  for (const r of rows) await idbDel(r.key).catch(() => {
  });
  return rows.length;
}
async function requeueRejected() {
  const rows = await listRejected();
  for (const r of rows) {
    if (r.record) await enqueueWrite(r.record);
    await idbDel(r.key).catch(() => {
    });
  }
  return rows.length;
}
function summarizeQueue(records) {
  const byType = {};
  let since = null;
  for (const rec of records) {
    byType[rec.type] = (byType[rec.type] || 0) + 1;
    if (since === null || rec.ts < since) since = rec.ts;
  }
  return { total: records.length, byType, since };
}
var inflight = null;
function flush() {
  if (!inflight) {
    inflight = doFlush().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
async function doFlush() {
  if (held) return { sent: 0, rejected: 0, remaining: await queueCount() };
  const queued = await listQueue();
  const synced = [];
  const parked = [];
  for (const { key, record } of queued) {
    try {
      await transport(record);
      await idbDel(key).catch(() => {
      });
      synced.push(record.idempotencyKey);
    } catch (err) {
      if (err?.permanent) {
        await idbSet(`${REJECTED_PREFIX}${key}`, { record, reason: String(err.message || err) }).catch(() => {
        });
        await idbDel(key).catch(() => {
        });
        parked.push(record.idempotencyKey);
        continue;
      }
      break;
    }
  }
  if (synced.length) {
    await markRecentSynced(synced);
    try {
      globalThis.localStorage?.setItem(LAST_SYNC_KEY, String(Date.now()));
    } catch {
    }
  }
  if (parked.length) await markRecentRejected(parked);
  return { sent: synced.length, rejected: parked.length, remaining: queued.length - synced.length - parked.length };
}
function setHeld(v) {
  held = !!v;
}
function lastSyncTs() {
  try {
    return Number(globalThis.localStorage?.getItem(LAST_SYNC_KEY)) || null;
  } catch {
    return null;
  }
}
function chipState({ pending, online, rejected }) {
  if (pending === 0 && rejected > 0) return { state: "rejected", icon: "\u{1F534}", label: t("rejected"), count: rejected };
  if (pending === 0) return { state: "synced", icon: "\u2713", label: t("synced"), count: 0 };
  if (online && !held) return { state: "syncing", icon: "\u23F3", label: t("syncing"), count: pending };
  return { state: "offline", icon: "\u26A0\uFE0F", label: t("not_sent"), count: pending };
}
async function renderChip(el) {
  if (!el) return;
  const pending = await queueCount();
  const online = globalThis.navigator?.onLine !== false && transportReady;
  const s = chipState({ pending, online, rejected: await rejectedCount() });
  el.dataset.state = s.state;
  el.innerHTML = `<span class="h-dot"></span><span>${s.icon} ${s.label}${s.count ? ` (${s.count})` : ""}</span>`;
}
async function preFlushCheck({ onReview } = {}) {
  const queued = await listQueue();
  if (!queued.length) return;
  setHeld(true);
  const { total, byType, since } = summarizeQueue(queued.map((q) => q.record));
  const sinceStr = since ? new Date(since).toLocaleString() : "\u2014";
  const lines = Object.entries(byType).map(([type, n]) => `<li>${t(type)} \xD7 ${n}</li>`).join("");
  showModal({
    title: `${total} ${t("pending_sync")}`,
    bodyHtml: `<div>${t("pending_since")}: ${sinceStr}</div><ul>${lines}</ul>`,
    actions: [
      { label: t("review"), kind: "ghost", onClick: (close) => {
        close();
        onReview?.();
      } },
      { label: t("sync_now"), kind: "primary", onClick: (close) => {
        setHeld(false);
        close();
        flush();
      } },
      { label: t("hold"), kind: "ghost", onClick: (close) => {
        setHeld(true);
        close();
      } }
    ]
  });
}
async function openSyncSheet(refresh) {
  const queued = await listQueue();
  const { total } = summarizeQueue(queued.map((q) => q.record));
  const rejectedRows = await listRejected();
  const online = globalThis.navigator?.onLine !== false;
  const last = lastSyncTs();
  const rejectedHtml = rejectedRows.length ? `<div>${t("rejected")}: <strong>${rejectedRows.length}</strong></div>
       <ul class="h-rejected-list">${rejectedRows.slice(0, 5).map((r) => `<li>${t(r.record?.type || "note")} \u2014 ${r.reason || ""}</li>`).join("")}</ul>` : "";
  const actions = [
    { label: t("sync_now"), kind: "primary", onClick: async (close) => {
      setHeld(false);
      await flush();
      close();
      refresh?.();
    } },
    { label: t("hold"), kind: "ghost", onClick: (close) => {
      setHeld(true);
      close();
      refresh?.();
    } }
  ];
  if (rejectedRows.length) {
    actions.push({ label: t("requeue_rejected"), kind: "ghost", onClick: async (close) => {
      await requeueRejected();
      close();
      refresh?.();
    } });
    actions.push({ label: t("discard_rejected"), kind: "ghost", onClick: async (close) => {
      await discardRejected();
      close();
      refresh?.();
    } });
  }
  showModal({
    title: t("sync_status"),
    bodyHtml: `
      <div>${t("offline_saved")}: <strong>${total}</strong></div>
      <div>${t("last_sync")}: ${last ? new Date(last).toLocaleTimeString() : "\u2014"}</div>
      <div>${t("network")}: ${online ? t("online") : t("offline")}</div>${rejectedHtml}`,
    actions
  });
}
function showModal({ title, bodyHtml, actions }) {
  if (typeof document === "undefined") return () => {
  };
  const overlay = document.createElement("div");
  overlay.className = "h-modal-overlay";
  const close = () => overlay.remove();
  overlay.innerHTML = `<div class="h-modal" role="dialog" aria-modal="true">
    <div class="h-modal-title">${title}</div>
    <div class="h-modal-body">${bodyHtml}</div>
    <div class="h-modal-actions"></div>
  </div>`;
  const actionsEl = overlay.querySelector(".h-modal-actions");
  for (const a of actions) {
    const btn = document.createElement("button");
    btn.className = "h-btn " + (a.kind === "primary" ? "h-btn-primary" : "h-btn-ghost");
    btn.textContent = a.label;
    btn.addEventListener("click", () => a.onClick(close));
    actionsEl.appendChild(btn);
  }
  document.body.appendChild(overlay);
  return close;
}

// src/handler/picker-cache.js
var KINDS = ["customer", "part", "job", "supplier"];
var CACHE = Object.fromEntries(KINDS.map((k) => [k, []]));
var KEY = (kind) => `pickcache:${kind}`;
function getCache(kind) {
  return CACHE[kind] || [];
}
function setCache(kind, items) {
  CACHE[kind] = Array.isArray(items) ? items : [];
  if (idbAvailable()) idbSet(KEY(kind), CACHE[kind]).catch(() => {
  });
  return CACHE[kind];
}
async function hydrateCaches(kinds = KINDS) {
  if (!idbAvailable()) return;
  for (const kind of kinds) {
    const saved = await idbGet(KEY(kind)).catch(() => null);
    if (Array.isArray(saved)) CACHE[kind] = saved;
  }
}
function customerToPickerItem(c) {
  return {
    id: c.id,
    primary: c.name,
    sub: c.default_billing_unit === "pcs" ? "pcs" : "kg",
    tier: c.default_quality_tier === "premium" ? "P" : "S"
  };
}
function itemToPickerItem(it) {
  return {
    id: it.id,
    primary: it.part_number || it.description,
    sub: it.description && it.description !== it.part_number ? it.description : it.default_unit || "",
    method: it.default_unit === "NOS" ? "NOS" : "KG"
  };
}
function jobToPickerItem(j, customerName) {
  const challan = j.challan_no || j.sep_invoicing_challan_no;
  return {
    id: j.id,
    primary: customerName || j.customer_id,
    sub: challan ? `Challan ${challan}` : j.id,
    method: j.current_status === "dispatched" ? "\u2713" : "\u2022"
  };
}
function customerNamesById(customers = []) {
  return Object.fromEntries(customers.map((c) => [c.id, c.name]));
}
var customersToPickerItems = (cs = []) => cs.map(customerToPickerItem);
var itemsToPickerItems = (its = []) => its.map(itemToPickerItem);
var jobsToPickerItems = (js = [], namesById = {}) => js.map((j) => jobToPickerItem(j, namesById[j.customer_id]));

export {
  LANGS,
  getLang,
  setLang,
  t,
  speak,
  idbAvailable,
  idbGet,
  idbSet,
  idbDel,
  loadRecent,
  getRecent,
  pushRecent,
  setTransport,
  clearTransport,
  enqueueWrite,
  flush,
  renderChip,
  preFlushCheck,
  openSyncSheet,
  showModal,
  getCache,
  setCache,
  hydrateCaches,
  customerNamesById,
  customersToPickerItems,
  itemsToPickerItems,
  jobsToPickerItems
};
//# sourceMappingURL=chunk-OVCQVVID.js.map
