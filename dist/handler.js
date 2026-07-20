import {
  DEF_CW,
  DEF_PERM,
  esc
} from "./chunks/chunk-IIQMR7WS.js";
import {
  LANGS,
  enqueueWrite,
  getCache,
  getLang,
  getRecent,
  hydrateCaches,
  idbAvailable,
  idbDel,
  idbGet,
  idbSet,
  loadRecent,
  openSyncSheet,
  preFlushCheck,
  pushRecent,
  renderChip,
  setLang,
  showModal,
  speak,
  t
} from "./chunks/chunk-OVCQVVID.js";
import {
  APP_VERSION,
  DEF_AREAS,
  DEF_STOCK,
  DFT_MICRON_MAX,
  PCS_MAX,
  QTY_MAX,
  deriveTotalQty
} from "./chunks/chunk-274TEG2F.js";
import "./chunks/chunk-IFG75HHC.js";

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
var SLOT_OPTS = [
  { value: "morning_ot", labelKey: "opt_morning_ot" },
  { value: "regular", labelKey: "opt_regular" },
  { value: "evening_ot", labelKey: "opt_evening_ot" }
];
var REASON_OPTS = [
  { value: "production_use", labelKey: "opt_use" },
  { value: "waste", labelKey: "opt_waste" },
  { value: "spillage", labelKey: "opt_spill" },
  { value: "theft", labelKey: "opt_theft" },
  { value: "other", labelKey: "opt_other" }
];
var PRIORITY_OPTS = [
  { value: "normal", labelKey: "opt_normal" },
  { value: "urgent", labelKey: "opt_urgent" }
];
function inferSlot() {
  const h = (/* @__PURE__ */ new Date()).getHours();
  if (h < 9) return "morning_ot";
  if (h < 17) return "regular";
  return "evening_ot";
}
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
var nonNegNumber = (v) => Number(v) >= 0 ? null : "\u2265 0";
var dftRange = (v) => Number(v) > DFT_MICRON_MAX ? `0\u2013${DFT_MICRON_MAX} \xB5m` : Number(v) > 0 ? null : "> 0";
var qtyUnlessRounds = (s) => !(Number(s.rounds) > 0 && Number(s.round_size) > 0);
var kgUnlessPcs = (s) => !(Number(s.received_pcs) > 0);
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
      // The register's native grain is rounds: "108-round" VAT days, "25×6"
      // batches. Either enter the total, or rounds × per-round size — the
      // transport derives the total when only rounds are given.
      { key: "rounds", labelKey: "f_rounds", kind: "number", icon: "\u{1F501}", validate: posNumber },
      { key: "round_size", labelKey: "f_round_size", kind: "number", icon: "\u2716\uFE0F", validate: posNumber },
      { key: "quantity", labelKey: "f_quantity", kind: "number", icon: "\u{1F522}", required: qtyUnlessRounds, validate: posNumber },
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
      // The customer's paperwork number — a label, not a key (the 107-
      // collision ruling, SCHEMA_CHANGELOG v2.1). Cross-reference only.
      { key: "challan_no", labelKey: "f_challan", kind: "text", icon: "\u{1F9FE}" },
      { key: "weight", labelKey: "f_weight", kind: "number", icon: "\u2696\uFE0F", required: kgUnlessPcs, validate: posNumber },
      // NOS-only challans (clamps/brackets counted in pieces) carry no kg.
      { key: "received_pcs", labelKey: "f_pcs", kind: "number", icon: "\u{1F522}", validate: posNumber },
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
      // Inspector judgment is a FIELD, not a formula (HANDLER_FORMS.md) — a
      // 7.8 µm reading can be a pass for a customer who accepts 7+.
      { key: "outcome", labelKey: "f_outcome", kind: "select", icon: "\u2696\uFE0F", required: true, options: [
        { value: "pass", labelKey: "opt_pass" },
        { value: "fail-rework", labelKey: "opt_fail_rework" }
      ] },
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
      { key: "reason", labelKey: "f_reason", kind: "select", icon: "\u2753", options: REASON_OPTS, default: "production_use", required: true },
      // The chemistry stock-take companion: how much is LEFT after this
      // draw. 0 = Shyam's "NIL" — surfaces as a reorder alert in the
      // dashboard's Live view. Optional; most floor draws skip it.
      { key: "level_after", labelKey: "f_level_after", kind: "number", icon: "\u{1F4CF}", validate: nonNegNumber },
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
      { key: "direction", labelKey: "f_direction", kind: "select", icon: "\u2194\uFE0F", options: DIRECTION_OPTS, required: true },
      // T-CH: the slot tag makes each in/out decompose straight into the
      // payroll OT model (morning 6–8:30 = 3 hr convention; evening post-5).
      // Defaults from the clock; overriding stays one tap.
      { key: "slot", labelKey: "f_slot", kind: "select", icon: "\u{1F555}", options: SLOT_OPTS, default: inferSlot, required: true }
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
        { value: "item", labelKey: "f_item" },
        // First-class incident kinds (codex power-cut-log evidence): a
        // power cut is a note today; the viewer surfaces urgent ones.
        { value: "power_cut", labelKey: "opt_power_cut" },
        { value: "incident", labelKey: "opt_incident" }
      ] },
      { key: "note_text", labelKey: "f_note_text", kind: "notes", icon: "\u{1F4DD}", required: true },
      { key: "priority", labelKey: "f_priority", kind: "select", icon: "\u{1F6A8}", options: PRIORITY_OPTS, default: "normal" }
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
        <span class="h-pcard-primary">${esc(it.primary)}</span>
        ${it.sub ? `<span class="h-pcard-sub">${esc(it.sub)}</span>` : ""}
        ${it.tier || it.method ? `<span class="h-pcard-tags">
          ${it.tier ? `<span class="h-tag">${esc(it.tier)}</span>` : ""}
          ${it.method ? `<span class="h-tag">${esc(it.method)}</span>` : ""}
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

// src/handler/sanity.js
function emptyStats() {
  return { n: 0, mean: 0, m2: 0 };
}
function pushStat(stats, x) {
  const s = stats && stats.n ? { ...stats } : emptyStats();
  const v = Number(x);
  if (!Number.isFinite(v)) return s;
  s.n += 1;
  const delta = v - s.mean;
  s.mean += delta / s.n;
  s.m2 += delta * (v - s.mean);
  return s;
}
function stdev(stats) {
  if (!stats || stats.n < 2) return 0;
  return Math.sqrt(stats.m2 / (stats.n - 1));
}
function zScore(stats, x) {
  const sd = stdev(stats);
  if (!(sd > 0)) return 0;
  return (Number(x) - stats.mean) / sd;
}
var MIN_HISTORY = 8;
var SANITY = {
  production: {
    quantity: { hardMin: 0, hardMax: QTY_MAX, softMax: 4e4, z: 3 },
    rounds: { hardMin: 0, hardMax: 2e3, softMax: 500, z: 3 },
    round_size: { hardMin: 0, hardMax: 5e3, softMax: 2e3, z: 3 }
  },
  job_receipt: {
    weight: { hardMin: 0, hardMax: QTY_MAX, softMax: 2e4, z: 3 },
    received_pcs: { hardMin: 0, hardMax: PCS_MAX, softMax: 2e5, z: 3 }
  },
  dft: {
    // No hardMax: exactly 50 µm is LEGAL in every other layer (rules <= 50,
    // Zod .max(50), the form's dftRange rejects only > 50 before sanity even
    // runs) — a hardMax:50 here (block on v >= 50) made the one legal boundary
    // reading unenterable. softMax keeps the confirm prompt for high readings.
    dft_micron: { hardMin: 0, softMin: 2, softMax: 30, z: 3 }
  },
  dispatch: {
    weight: { hardMin: 0, hardMax: QTY_MAX, softMax: 2e4, z: 3 }
  },
  stock_refill: {
    quantity: { hardMin: 0, hardMax: QTY_MAX, softMax: 5e3, z: 3 },
    // No hardMin: 0 is a legitimate cost (an unpriced/free receipt); the
    // mapper only records unit_cost when cost > 0 anyway. A hardMin:0 here
    // would block-then-refuse a 0, which is not an impossible value.
    cost: { hardMax: 1e7, softMax: 1e6, z: 3 }
  },
  stock_deplete: {
    quantity: { hardMin: 0, hardMax: QTY_MAX, softMax: 5e3, z: 3 },
    // No hardMin: level_after: 0 is Shyam's NIL stock-take — the reorder-alert
    // signal, a VALID reading. Blocking v <= hardMin(0) would make NIL
    // unenterable. Negatives are already caught by Zod (nonnegative) + the
    // form's nonNegNumber validate.
    level_after: { hardMax: QTY_MAX, softMax: 2e4, z: 3 }
  }
};
function fieldVerdict(value, cfg, stats) {
  if (!cfg) return { level: "ok" };
  const v = Number(value);
  if (value == null || String(value).trim() === "" || !Number.isFinite(v)) return { level: "ok" };
  if (cfg.hardMax != null && v >= cfg.hardMax) return { level: "block", reason: `\u2265 ${cfg.hardMax}` };
  if (cfg.hardMin != null && v <= cfg.hardMin) return { level: "block", reason: `\u2264 ${cfg.hardMin}` };
  if (cfg.softMax != null && v > cfg.softMax) return { level: "confirm", reason: `> ${cfg.softMax}` };
  if (cfg.softMin != null && v < cfg.softMin) return { level: "confirm", reason: `< ${cfg.softMin}` };
  if (stats && stats.n >= MIN_HISTORY) {
    const z = zScore(stats, v);
    if (Math.abs(z) >= (cfg.z ?? 3)) {
      return { level: "confirm", reason: `${z > 0 ? "+" : ""}${z.toFixed(1)}\u03C3` };
    }
  }
  return { level: "ok" };
}
var SCOPES = {
  // Pickling areas get their own distribution per group: same unit as their
  // plating group (transport's qty choice follows group), but a different
  // process with different typical volumes — pooling them would widen σ for
  // both. DEF_AREAS marks pickling areas with dep:true.
  production: (s) => {
    const a = DEF_AREAS.find((x) => x.id === s.machine);
    return a ? a.dep ? `${a.group}-pickling` : a.group : void 0;
  },
  stock_refill: (s) => s.item,
  stock_deplete: (s) => s.item
};
function statKey(type, field, state = {}) {
  const scopeFn = SCOPES[type];
  if (!scopeFn) return field;
  return `${field}@${scopeFn(state) || "?"}`;
}
function checkRecord(type, state = {}, baselines = {}) {
  const cfgs = SANITY[type];
  if (!cfgs) return [];
  const flags = [];
  for (const [key, cfg] of Object.entries(cfgs)) {
    const raw = state[key];
    const verdict = fieldVerdict(raw, cfg, baselines[statKey(type, key, state)]);
    if (verdict.level !== "ok") flags.push({ key, value: Number(raw), ...verdict });
  }
  const rank = { block: 0, confirm: 1 };
  return flags.sort((a, b) => rank[a.level] - rank[b.level]);
}
function statFields(type) {
  return Object.keys(SANITY[type] || {});
}
function deriveSanityState(type, state = {}) {
  if (type !== "production") return state;
  const total = deriveTotalQty(state);
  if (total === void 0 || Number(state.quantity) === total) return state;
  return { ...state, quantity: total };
}

// src/handler/form.js
var DRAFT_PREFIX = "draft:";
var LASTVALS_PREFIX = "lastvals:";
var STATS_PREFIX = "stats:";
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
  const baselines = (idbAvailable() ? await idbGet(STATS_PREFIX + def.id).catch(() => null) : null) || {};
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
  const scheduleDraft = debounce(() => {
    if (idbAvailable()) idbSet(DRAFT_PREFIX + def.id, { ...state }).catch(() => {
    });
  }, 200);
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
    } else if (f.default != null) {
      const dv = typeof f.default === "function" ? f.default() : f.default;
      if (dv != null && dv !== "") fieldApi[f.key].setValue(dv);
    }
  }
  await maybeResumeDraft(def, state, fieldApi);
  host.querySelector(".h-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstBad = validate(def, state, fieldsEl);
    if (firstBad) {
      signalError(t("required"));
      firstBad.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const judged = deriveSanityState(def.id, state);
    const flags = checkRecord(def.id, judged, baselines);
    if (flags.length) {
      const proceed = await confirmSanity(def, flags);
      if (!proceed) {
        signalError(t("unusual_title"));
        return;
      }
    }
    const record = buildRecord(def, state, idempotencyKey);
    await enqueueWrite(record);
    await rememberLastVals(def, state);
    const skip = new Set(flags.map((f) => f.key));
    if (def.id === "production" && skip.has("quantity")) {
      skip.add("rounds");
      skip.add("round_size");
    }
    await updateBaselines(def, judged, baselines, skip);
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
    const required = typeof f.required === "function" ? f.required(state) : f.required;
    if (required && (val == null || String(val).trim() === "")) err = t("required");
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
    if (state[f.key] != null && String(state[f.key]).trim() !== "") {
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
async function updateBaselines(def, state, baselines, skipKeys = /* @__PURE__ */ new Set()) {
  if (!idbAvailable()) return;
  const next = { ...baselines };
  let touched = false;
  for (const key of statFields(def.id)) {
    if (skipKeys.has(key)) continue;
    const v = state[key];
    if (v == null || String(v).trim() === "" || !Number.isFinite(Number(v))) continue;
    const sk = statKey(def.id, key, state);
    next[sk] = pushStat(next[sk] || emptyStats(), Number(v));
    touched = true;
  }
  if (touched) await idbSet(STATS_PREFIX + def.id, next).catch(() => {
  });
}
function confirmSanity(def, flags) {
  const labelFor = (key) => t(def.fields.find((f) => f.key === key)?.labelKey || key);
  const hasBlock = flags.some((f) => f.level === "block");
  const rows = flags.map(
    (f) => `<li><strong>${labelFor(f.key)}</strong>: ${f.value} <span class="h-sanity-reason">(${f.reason})</span></li>`
  ).join("");
  return new Promise((resolve) => {
    const actions = [{ label: t("go_fix"), kind: "ghost", onClick: (close) => {
      close();
      resolve(false);
    } }];
    if (!hasBlock) {
      actions.push({ label: t("confirm_correct"), kind: "ghost", onClick: (close) => {
        close();
        resolve(true);
      } });
    }
    showModal({ title: t("unusual_title"), bodyHtml: `<div>${t("unusual_ask")}</div><ul class="h-sanity-list">${rows}</ul>`, actions });
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
        <span class="h-recent-text">${t(e.type)} \xB7 ${esc(e.summary)}</span>
        <span class="h-recent-status">${e.status === "queued" ? "\u23F3" : e.status === "rejected" ? "\u{1F534}" : "\u2713"}</span>
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
  import("./chunks/firebase-boot-3WUGURKJ.js").then((m) => m.startFirebase({ onChange: refreshChip })).catch(() => {
  });
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
