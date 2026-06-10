import {
  APP_VERSION,
  DEF_AREAS,
  DEF_CW,
  DEF_PERM,
  DEF_STOCK
} from "./chunks/chunk-6SUC6FMW.js";

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
  f_item: { hi: "\u0938\u093E\u092E\u093E\u0928", en: "Item" },
  f_supplier: { hi: "\u0938\u092A\u094D\u0932\u093E\u092F\u0930", en: "Supplier" },
  f_cost: { hi: "\u0915\u0940\u092E\u0924 (\u20B9)", en: "Cost (\u20B9)" },
  f_state: { hi: "\u0938\u094D\u0925\u093F\u0924\u093F", en: "State" },
  f_direction: { hi: "\u0906\u0928\u093E/\u091C\u093E\u0928\u093E", en: "In / Out" },
  f_note_text: { hi: "\u0915\u094D\u092F\u093E \u0932\u093F\u0916\u0928\u093E \u0939\u0948", en: "What to note" },
  f_note_kind: { hi: "\u0915\u093F\u0938 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902", en: "About" },
  f_self: { hi: "\u0916\u0941\u0926", en: "self" },
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
  stage_d_note: { hi: "\u092A\u0942\u0930\u0947 \u092B\u093C\u0940\u0932\u094D\u0921 \u0938\u094D\u091F\u0947\u091C D \u092E\u0947\u0902 \u0906\u090F\u0901\u0917\u0947", en: "Full fields land in Stage D" }
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

// src/handler/feedback.js
var MUTE_KEY = "sep_handler_mute";
function isMuted() {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
function setMuted(on) {
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, on ? "1" : "0");
  } catch {
  }
}
var audioCtx = null;
function tone(freq = 880, ms = 120) {
  if (isMuted()) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  try {
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(1e-4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + ms / 1e3);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1e3);
  } catch {
  }
}
function vibrate(pattern) {
  try {
    globalThis.navigator?.vibrate?.(pattern);
  } catch {
  }
}
function toast(msg, variant = "ok", ms = 2e3) {
  if (typeof document === "undefined") return;
  let wrap = document.querySelector(".h-toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "h-toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = "h-toast" + (variant === "warn" ? " h-toast-warn" : variant === "bad" ? " h-toast-bad" : "");
  el.setAttribute("role", "status");
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function confirmSaved(label) {
  toast(`\u2713 ${label || t("saved")}`, "ok");
  vibrate(50);
  tone(880, 120);
}
function signalError(msg) {
  toast(`\u26A0\uFE0F ${msg}`, "bad");
  vibrate([40, 60, 40]);
  tone(220, 200);
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
  const set = new Set(idempotencyKeys);
  let changed = false;
  cache = cache.map((e) => {
    if (e.status === "queued" && set.has(e.idempotencyKey)) {
      changed = true;
      return { ...e, status: "synced" };
    }
    return e;
  });
  if (changed && idbAvailable()) await idbSet(RECENT_KEY, cache).catch(() => {
  });
  return cache;
}

// src/handler/sync.js
var QUEUE_PREFIX = "queue:";
var LAST_SYNC_KEY = "sep_handler_last_sync";
var held = false;
var transport = async () => {
  throw new Error("no-transport");
};
var transportReady = false;
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
function summarizeQueue(records) {
  const byType = {};
  let since = null;
  for (const rec of records) {
    byType[rec.type] = (byType[rec.type] || 0) + 1;
    if (since === null || rec.ts < since) since = rec.ts;
  }
  return { total: records.length, byType, since };
}
async function flush() {
  if (held) return { sent: 0, remaining: await queueCount() };
  const queued = await listQueue();
  const synced = [];
  for (const { key, record } of queued) {
    try {
      await transport(record);
      await idbDel(key).catch(() => {
      });
      synced.push(record.idempotencyKey);
    } catch {
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
  return { sent: synced.length, remaining: queued.length - synced.length };
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
  if (rejected > 0) return { state: "rejected", icon: "\u{1F534}", label: t("rejected"), count: rejected };
  if (pending === 0) return { state: "synced", icon: "\u2713", label: t("synced"), count: 0 };
  if (online && !held) return { state: "syncing", icon: "\u23F3", label: t("syncing"), count: pending };
  return { state: "offline", icon: "\u26A0\uFE0F", label: t("not_sent"), count: pending };
}
async function renderChip(el) {
  if (!el) return;
  const pending = await queueCount();
  const online = globalThis.navigator?.onLine !== false && transportReady;
  const s = chipState({ pending, online, rejected: 0 });
  el.dataset.state = s.state;
  el.innerHTML = `<span class="h-dot"></span><span>${s.icon} ${s.label}${s.count ? ` (${s.count})` : ""}</span>`;
}
async function preFlushCheck({ onReview } = {}) {
  const queued = await listQueue();
  if (!queued.length) return;
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
  const online = globalThis.navigator?.onLine !== false;
  const last = lastSyncTs();
  showModal({
    title: t("sync_status"),
    bodyHtml: `
      <div>${t("offline_saved")}: <strong>${total}</strong></div>
      <div>${t("last_sync")}: ${last ? new Date(last).toLocaleTimeString() : "\u2014"}</div>
      <div>${t("network")}: ${online ? t("online") : t("offline")}</div>`,
    actions: [
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
    ]
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
async function hydrateCaches(kinds = KINDS) {
  if (!idbAvailable()) return;
  for (const kind of kinds) {
    const saved = await idbGet(KEY(kind)).catch(() => null);
    if (Array.isArray(saved)) CACHE[kind] = saved;
  }
}

// src/handler/forms-registry.js
var workerItems = () => [
  ...DEF_PERM.filter((w) => !w.inactive).map((w) => ({ id: w.id, primary: w.name, sub: w.role })),
  ...DEF_CW.filter((w) => !w.inactive).map((w) => ({ id: w.id, primary: w.name, sub: "Contractor" }))
];
var machineItems = () => DEF_AREAS.map((a) => ({
  id: a.id,
  primary: a.name,
  sub: a.group,
  method: a.group === "vat" ? "V" : a.group === "barrel" ? "B" : "\u2014"
}));
var itemItems = () => DEF_STOCK.map((s) => ({ id: s.id, primary: s.name, sub: s.unit }));
var partItems = () => getCache("part");
var jobItems = () => getCache("job");
var customerItems = () => getCache("customer");
var supplierItems = () => getCache("supplier");
var STATION_OPTS = [
  { value: "pickling", labelKey: "opt_pickling" },
  { value: "plating", labelKey: "opt_plating" },
  { value: "passivation", labelKey: "opt_passivation" },
  { value: "inspection", labelKey: "opt_inspection" }
];
var STATE_OPTS = [
  { value: "running", labelKey: "opt_running" },
  { value: "idle", labelKey: "opt_idle" },
  { value: "down", labelKey: "opt_down" }
];
var DIRECTION_OPTS = [
  { value: "in", labelKey: "opt_in" },
  { value: "out", labelKey: "opt_out" }
];
var PICKERS = {
  job: jobItems,
  machine: machineItems,
  worker: workerItems,
  customer: customerItems,
  item: itemItems,
  part: partItems,
  supplier: supplierItems
};
var posNumber = (v) => Number(v) > 0 ? null : "> 0";
var dftRange = (v) => Number(v) > 50 ? "0\u201350 \xB5m" : Number(v) > 0 ? null : "> 0";
var FORMS = [
  {
    id: "production",
    icon: "\u{1F3ED}",
    titleKey: "production",
    mode: "continue",
    pickers: PICKERS,
    fields: [
      { key: "job", labelKey: "f_job", kind: "picker", pickerKey: "job", icon: "\u{1F4CB}", required: true, remember: true },
      // Customer SKU run on this job — the register keys on customer+SKU.
      // Optional in alpha (the part cache is empty until Track 2 hydration).
      { key: "part", labelKey: "f_part", kind: "picker", pickerKey: "part", icon: "\u{1F3F7}\uFE0F", remember: true },
      { key: "machine", labelKey: "f_machine", kind: "picker", pickerKey: "machine", icon: "\u{1F527}", required: true, remember: true },
      { key: "worker", labelKey: "f_worker", kind: "picker", pickerKey: "worker", icon: "\u{1F477}", required: true, remember: true },
      { key: "quantity", labelKey: "f_quantity", kind: "number", icon: "\u{1F522}", required: true, validate: posNumber },
      { key: "station", labelKey: "f_station", kind: "select", icon: "\u{1F4CD}", options: STATION_OPTS, remember: true },
      { key: "notes", labelKey: "f_notes", kind: "notes" }
    ]
  },
  {
    id: "job_receipt",
    icon: "\u{1F4CB}",
    titleKey: "job_receipt",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "customer", labelKey: "f_customer", kind: "picker", pickerKey: "customer", icon: "\u{1F3E2}", required: true },
      { key: "weight", labelKey: "f_weight", kind: "number", icon: "\u2696\uFE0F", required: true, validate: posNumber },
      { key: "notes", labelKey: "f_notes", kind: "notes" }
    ]
  },
  {
    id: "dft",
    icon: "\u{1F52C}",
    titleKey: "dft",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "job", labelKey: "f_job", kind: "picker", pickerKey: "job", icon: "\u{1F4CB}", required: true },
      { key: "dft_micron", labelKey: "f_dft_micron", kind: "number", icon: "\u{1F52C}", required: true, validate: dftRange },
      { key: "notes", labelKey: "f_notes", kind: "notes" }
    ]
  },
  {
    id: "dispatch",
    icon: "\u{1F69A}",
    titleKey: "dispatch",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "job", labelKey: "f_job", kind: "picker", pickerKey: "job", icon: "\u{1F4CB}", required: true },
      { key: "weight", labelKey: "f_weight", kind: "number", icon: "\u2696\uFE0F", validate: posNumber },
      { key: "notes", labelKey: "f_notes", kind: "notes" }
    ]
  },
  {
    id: "stock_refill",
    icon: "\u{1F4E6}",
    titleKey: "stock_refill",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "item", labelKey: "f_item", kind: "picker", pickerKey: "item", icon: "\u{1F4E6}", required: true },
      { key: "supplier", labelKey: "f_supplier", kind: "picker", pickerKey: "supplier", icon: "\u{1F69B}" },
      { key: "quantity", labelKey: "f_quantity", kind: "number", icon: "\u{1F522}", required: true, validate: posNumber },
      { key: "cost", labelKey: "f_cost", kind: "number", icon: "\u20B9" },
      { key: "notes", labelKey: "f_notes", kind: "notes" }
    ]
  },
  {
    id: "stock_deplete",
    icon: "\u{1F4E4}",
    titleKey: "stock_deplete",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "item", labelKey: "f_item", kind: "picker", pickerKey: "item", icon: "\u{1F4E6}", required: true },
      { key: "quantity", labelKey: "f_quantity", kind: "number", icon: "\u{1F522}", required: true, validate: posNumber },
      { key: "notes", labelKey: "f_notes", kind: "notes" }
    ]
  },
  {
    id: "machine_state",
    icon: "\u{1F527}",
    titleKey: "machine_state",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "machine", labelKey: "f_machine", kind: "picker", pickerKey: "machine", icon: "\u{1F527}", required: true },
      { key: "state", labelKey: "f_state", kind: "select", icon: "\u{1F6A6}", options: STATE_OPTS, required: true },
      { key: "notes", labelKey: "f_notes", kind: "notes" }
    ]
  },
  {
    id: "check_in",
    icon: "\u23F1",
    titleKey: "check_in",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "worker", labelKey: "f_worker", kind: "picker", pickerKey: "worker", icon: "\u{1F477}", required: true },
      { key: "direction", labelKey: "f_direction", kind: "select", icon: "\u2194\uFE0F", options: DIRECTION_OPTS, required: true }
    ]
  },
  {
    id: "note",
    icon: "\u{1F4DD}",
    titleKey: "note",
    mode: "return",
    pickers: PICKERS,
    fields: [
      { key: "note_kind", labelKey: "f_note_kind", kind: "select", icon: "\u{1F3F7}\uFE0F", options: [
        { value: "machine", labelKey: "f_machine" },
        { value: "job", labelKey: "f_job" },
        { value: "worker", labelKey: "f_worker" },
        { value: "item", labelKey: "f_item" }
      ] },
      { key: "note_text", labelKey: "f_note_text", kind: "notes", icon: "\u{1F4DD}", required: true }
    ]
  }
];
function getForm(id) {
  return FORMS.find((f) => f.id === id);
}

// src/handler/picker.js
function openPicker({ titleKey, items, onPick }) {
  if (typeof document === "undefined") return () => {
  };
  const overlay = document.createElement("div");
  overlay.className = "h-sheet-overlay";
  const close = () => overlay.remove();
  overlay.innerHTML = `<div class="h-sheet" role="dialog" aria-modal="true">
    <div class="h-sheet-head">
      <div class="h-sheet-title">${t(titleKey)}</div>
      <button class="h-sheet-close" aria-label="${t("cancel")}">\u2715</button>
    </div>
    <input class="h-picker-search" type="search" inputmode="search"
           placeholder="${t("search_more")}\u2026" aria-label="${t("search_more")}">
    <div class="h-sheet-body"><div class="h-picker-grid"></div></div>
  </div>`;
  const grid = overlay.querySelector(".h-picker-grid");
  const search = overlay.querySelector(".h-picker-search");
  const render = (list) => {
    grid.innerHTML = "";
    for (const it of list) {
      const card = document.createElement("button");
      card.className = "h-pcard";
      card.dataset.id = it.id;
      if (it.tier) card.dataset.tier = it.tier;
      card.innerHTML = `
        <span class="h-pcard-primary">${it.primary}</span>
        ${it.sub ? `<span class="h-pcard-sub">${it.sub}</span>` : ""}
        ${it.tier || it.method ? `<span class="h-pcard-tags">
          ${it.tier ? `<span class="h-tag">${it.tier}</span>` : ""}
          ${it.method ? `<span class="h-tag">${it.method}</span>` : ""}
        </span>` : ""}`;
      card.addEventListener("click", () => {
        onPick(it);
        close();
      });
      grid.appendChild(card);
    }
    if (!list.length) grid.innerHTML = `<div class="h-empty">${t("no_recent")}</div>`;
  };
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    render(!q ? items : items.filter((it) => `${it.primary} ${it.sub || ""} ${it.id}`.toLowerCase().includes(q)));
  });
  overlay.querySelector(".h-sheet-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  render(items);
  document.body.appendChild(overlay);
  return close;
}

// src/handler/form.js
var DRAFT_PREFIX = "draft:";
var LASTVALS_PREFIX = "lastvals:";
function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}
function debounce(fn, ms) {
  let h;
  return (...a) => {
    clearTimeout(h);
    h = setTimeout(() => fn(...a), ms);
  };
}
async function renderForm(host, def, ctx = {}) {
  const idempotencyKey = uuid();
  const state = { __idem: idempotencyKey };
  const lastVals = (idbAvailable() ? await idbGet(LASTVALS_PREFIX + def.id).catch(() => null) : null) || {};
  host.innerHTML = `
    <div class="h-form-head">
      <button class="h-back" aria-label="${t("back")}">\u2190</button>
      <div class="h-screen-title">${t(def.titleKey)}</div>
    </div>
    <form class="h-form" novalidate>
      <div class="h-fields"></div>
      <div class="h-actions">
        <button type="button" class="h-btn h-btn-ghost h-cancel">${t("cancel")}</button>
        <button type="submit" class="h-btn h-btn-primary h-submit">
          ${t(def.mode === "continue" ? "submit_continue" : "submit_return")}
        </button>
      </div>
    </form>`;
  const fieldsEl = host.querySelector(".h-fields");
  host.querySelector(".h-back").addEventListener("click", () => ctx.onBack?.());
  host.querySelector(".h-cancel").addEventListener("click", () => {
    clearDraft(def.id);
    ctx.onBack?.();
  });
  const fieldApi = {};
  for (const f of def.fields) {
    const wrap = document.createElement("div");
    wrap.className = "h-field";
    wrap.dataset.key = f.key;
    const labelHtml = `<div class="h-field-label">
        ${f.icon ? `<span class="h-field-icon">${f.icon}</span>` : ""}
        <span>${t(f.labelKey)}</span>
        <span class="h-field-en">${t(f.labelKey, "en")}</span>
        <span class="h-tts" role="button" aria-label="speak">\u{1F50A}</span>
      </div>`;
    let controlHtml = "";
    if (f.kind === "picker") {
      controlHtml = `<button type="button" class="h-chooser">
          <span class="h-chooser-val h-placeholder">${t("choose")}</span>
          <span class="h-chooser-change">${t("change")}</span>
        </button>`;
    } else if (f.kind === "select") {
      const opts = (f.options || []).map((o) => `<option value="${o.value}">${t(o.labelKey)}</option>`).join("");
      controlHtml = `<select class="h-select"><option value="">${t("choose")}</option>${opts}</select>`;
    } else if (f.kind === "notes") {
      controlHtml = `<textarea class="h-textarea" rows="3"></textarea>`;
    } else {
      const num = f.kind === "number";
      controlHtml = `<input class="h-input" type="${num ? "text" : "text"}"
        inputmode="${num ? "numeric" : f.inputmode || "text"}"
        ${f.placeholder ? `placeholder="${f.placeholder}"` : ""}>`;
    }
    wrap.innerHTML = labelHtml + controlHtml + `<div class="h-field-error">\u26A0\uFE0F <span></span></div>`;
    fieldsEl.appendChild(wrap);
    const ttsBtn = wrap.querySelector(".h-tts");
    ttsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      speak(f.labelKey);
    });
    bindLongPress(wrap.querySelector(".h-field-label"), () => speak(f.labelKey));
    if (f.kind === "picker") {
      const chooser = wrap.querySelector(".h-chooser");
      const valEl = chooser.querySelector(".h-chooser-val");
      const setValue = (item) => {
        state[f.key] = item ? item.id : "";
        state[`${f.key}__label`] = item ? item.primary : "";
        valEl.textContent = item ? item.primary : t("choose");
        valEl.classList.toggle("h-placeholder", !item);
        scheduleDraft();
      };
      chooser.addEventListener("click", () => {
        const items = def.pickers?.[f.pickerKey]?.() || [];
        openPicker({ titleKey: f.labelKey, items, onPick: setValue });
      });
      fieldApi[f.key] = { setValue: (id) => {
        const items = def.pickers?.[f.pickerKey]?.() || [];
        setValue(items.find((i) => i.id === id) || null);
      } };
    } else {
      const ctrl = wrap.querySelector(".h-input, .h-select, .h-textarea");
      ctrl.addEventListener("input", () => {
        state[f.key] = ctrl.value;
        clearError(wrap);
        scheduleDraft();
      });
      fieldApi[f.key] = { setValue: (v) => {
        ctrl.value = v ?? "";
        state[f.key] = ctrl.value;
      } };
    }
    if (lastVals[f.key] != null && lastVals[f.key] !== "") {
      fieldApi[f.key].setValue(lastVals[f.key]);
      wrap.classList.add("h-prefilled");
      const hint = document.createElement("div");
      hint.className = "h-prefill-hint";
      hint.textContent = t("still_same");
      wrap.appendChild(hint);
    }
  }
  const scheduleDraft = debounce(() => {
    if (idbAvailable()) idbSet(DRAFT_PREFIX + def.id, { ...state }).catch(() => {
    });
  }, 200);
  await maybeResumeDraft(def, state, fieldApi);
  host.querySelector(".h-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstBad = validate(def, state, fieldsEl);
    if (firstBad) {
      signalError(t("required"));
      firstBad.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const record = buildRecord(def, state, idempotencyKey);
    await enqueueWrite(record);
    await rememberLastVals(def, state);
    await pushRecent({
      type: def.id,
      idempotencyKey,
      summary: summarize(def, state),
      ts: record.ts,
      status: "queued"
    });
    clearDraft(def.id);
    confirmSaved();
    ctx.afterSubmit?.(record);
  });
}
function bindLongPress(el, fn) {
  let timer;
  const start = () => {
    timer = setTimeout(fn, 500);
  };
  const cancel = () => clearTimeout(timer);
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel);
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
}
function validate(def, state, fieldsEl) {
  let first = null;
  for (const f of def.fields) {
    const wrap = fieldsEl.querySelector(`.h-field[data-key="${f.key}"]`);
    const val = state[f.key];
    let err = null;
    if (f.required && (val == null || String(val).trim() === "")) err = t("required");
    else if (f.validate && val != null && String(val).trim() !== "") err = f.validate(val);
    if (err) {
      wrap.classList.add("h-invalid");
      wrap.querySelector(".h-field-error span").textContent = err;
      if (!first) first = wrap;
    } else clearError(wrap);
  }
  return first;
}
function clearError(wrap) {
  wrap.classList.remove("h-invalid");
}
function buildRecord(def, state, idempotencyKey) {
  const fields = {};
  for (const f of def.fields) {
    if (state[f.key] != null && state[f.key] !== "") {
      fields[f.key] = f.kind === "number" ? Number(state[f.key]) : state[f.key];
      if (state[`${f.key}__label`]) fields[`${f.key}__label`] = state[`${f.key}__label`];
    }
  }
  return { type: def.id, idempotencyKey, ts: Date.now(), fields };
}
function summarize(def, state) {
  const parts = [];
  for (const f of def.fields.slice(0, 3)) {
    const v = state[`${f.key}__label`] || state[f.key];
    if (v) parts.push(v);
  }
  return parts.join(" \xB7 ") || t(def.titleKey);
}
async function rememberLastVals(def, state) {
  if (!idbAvailable()) return;
  const keep = {};
  for (const f of def.fields) {
    if (f.remember && state[f.key] != null && state[f.key] !== "") keep[f.key] = state[f.key];
  }
  await idbSet(LASTVALS_PREFIX + def.id, keep).catch(() => {
  });
}
function clearDraft(type) {
  if (idbAvailable()) idbDel(DRAFT_PREFIX + type).catch(() => {
  });
}
async function maybeResumeDraft(def, state, fieldApi) {
  if (!idbAvailable()) return;
  const draft = await idbGet(DRAFT_PREFIX + def.id).catch(() => null);
  if (!draft || !hasContent(def, draft)) return;
  await new Promise((resolve) => {
    showModal({
      title: t("resume_q"),
      bodyHtml: `<div>${summarize(def, draft)}</div>`,
      actions: [
        { label: t("yes"), kind: "primary", onClick: (close) => {
          for (const f of def.fields) if (draft[f.key] != null) fieldApi[f.key]?.setValue(draft[f.key]);
          Object.assign(state, draft);
          close();
          resolve();
        } },
        { label: t("no"), kind: "ghost", onClick: (close) => {
          clearDraft(def.id);
          close();
          resolve();
        } }
      ]
    });
  });
}
function hasContent(def, draft) {
  return def.fields.some((f) => draft[f.key] != null && String(draft[f.key]).trim() !== "");
}

// src/handler/main.js
var NAME_KEY = "sep_handler_name";
var root = () => document.getElementById("handler-root");
function handlerName() {
  try {
    return globalThis.localStorage?.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}
function currentShift() {
  const h = (/* @__PURE__ */ new Date()).getHours();
  if (h < 9) return "shift_m";
  if (h < 17) return "shift_s";
  return "shift_e";
}
function topBar() {
  const now = /* @__PURE__ */ new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const name = handlerName();
  return `<div class="h-topbar">
    <span class="h-clock">${time}</span>
    <span class="h-shift">\xB7 ${t(currentShift())}</span>
    ${name ? `<span class="h-who">\xB7 ${name}</span>` : ""}
    <span class="h-spacer"></span>
    <button class="h-chip" id="h-chip" data-state="synced" aria-label="${t("sync_status")}"></button>
    <button class="h-gear" id="h-gear" aria-label="${t("settings")}">\u2699</button>
  </div>`;
}
function refreshChip() {
  renderChip(document.getElementById("h-chip"));
}
function renderHome() {
  const tiles = FORMS.map((f) => `
    <button class="h-tile" data-form="${f.id}">
      <span class="h-tile-icon">${f.icon}</span>
      <span class="h-tile-label">${t(f.titleKey)}</span>
      <span class="h-tile-en">${t(f.titleKey, "en")}</span>
    </button>`).join("");
  const recent = getRecent();
  const recentRows = recent.length ? recent.map((e) => `<div class="h-recent-row">
        <span class="h-recent-time">${new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span class="h-recent-text">${t(e.type)} \xB7 ${e.summary}</span>
        <span class="h-recent-status">${e.status === "queued" ? "\u23F3" : "\u2713"}</span>
      </div>`).join("") : `<div class="h-empty">${t("no_recent")}</div>`;
  root().innerHTML = topBar() + `<div class="h-body">
    <div class="h-tiles">${tiles}</div>
    <div class="h-recent-h">${t("recent_entries")}</div>
    <div class="h-recent-list">${recentRows}</div>
  </div>`;
  root().querySelectorAll(".h-tile").forEach((tile) => tile.addEventListener("click", () => openForm(tile.dataset.form)));
  wireTopBar();
  refreshChip();
}
function openForm(id) {
  const def = getForm(id);
  if (!def) return renderHome();
  root().innerHTML = topBar() + `<div class="h-body"><div id="h-form-host"></div></div>`;
  wireTopBar();
  refreshChip();
  renderForm(document.getElementById("h-form-host"), def, {
    onBack: renderHome,
    afterSubmit: () => {
      refreshChip();
      if (def.mode === "continue") openForm(id);
      else renderHome();
    }
  });
}
function wireTopBar() {
  document.getElementById("h-gear")?.addEventListener("click", openSettings);
  document.getElementById("h-chip")?.addEventListener("click", () => openSyncSheet(refreshChip));
}
function openSettings() {
  const lang = getLang();
  const muted = isMuted();
  const langSeg = LANGS.map((l) => `<button data-lang="${l}" class="${l === lang ? "active" : ""}">${l === "hi" ? "\u0939\u093F\u0902" : "EN"}</button>`).join("");
  const close = showModal({
    title: t("settings"),
    bodyHtml: `
      <div class="h-set-row">
        <span class="h-set-label">${t("language")}</span>
        <span class="h-seg" id="h-lang-seg">${langSeg}</span>
      </div>
      <div class="h-set-row">
        <span class="h-set-label">${t("sound")}</span>
        <span class="h-seg" id="h-sound-seg">
          <button data-mute="0" class="${muted ? "" : "active"}">\u{1F50A}</button>
          <button data-mute="1" class="${muted ? "active" : ""}">\u{1F507}</button>
        </span>
      </div>
      <div class="h-set-row">
        <span class="h-set-label">${t("handler_name")}</span>
        <input class="h-input" id="h-name-input" style="max-width:160px" value="${handlerName()}">
      </div>
      <div class="h-set-row"><span class="h-set-label" style="color:var(--text-muted)">v${APP_VERSION}</span></div>`,
    actions: [{ label: t("back"), kind: "primary", onClick: (c) => c() }]
  });
  document.getElementById("h-lang-seg")?.addEventListener("click", (e) => {
    const l = e.target.dataset?.lang;
    if (!l) return;
    setLang(l);
    speak("settings");
    close();
    renderHome();
    openSettings();
  });
  document.getElementById("h-sound-seg")?.addEventListener("click", (e) => {
    const m = e.target.dataset?.mute;
    if (m == null) return;
    setMuted(m === "1");
    close();
    openSettings();
  });
  document.getElementById("h-name-input")?.addEventListener("change", (e) => {
    try {
      globalThis.localStorage?.setItem(NAME_KEY, e.target.value.trim());
    } catch {
    }
  });
}
async function boot() {
  if (!root()) return;
  document.documentElement.lang = getLang();
  await loadRecent();
  await hydrateCaches().catch(() => {
  });
  renderHome();
  setInterval(() => {
    const clock = document.querySelector(".h-topbar .h-clock");
    if (clock) clock.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, 6e4);
  preFlushCheck({ onReview: () => openSyncSheet(refreshChip) });
  globalThis.addEventListener?.("online", refreshChip);
  globalThis.addEventListener?.("offline", refreshChip);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw-handler.js", { scope: "./" }).catch(() => {
    });
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
//# sourceMappingURL=handler.js.map
