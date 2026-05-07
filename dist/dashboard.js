import {
  APP_VERSION,
  formatDate,
  formatDateShort,
  getWeekEnd,
  isSunday,
  localDateStr,
  tnow
} from "./chunks/chunk-D5KUF7LV.js";

// src/shared/pubsub.js
var listeners = /* @__PURE__ */ new Map();
function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}
function off(event, fn) {
  listeners.get(event)?.delete(fn);
}
function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.error("[pubsub]", event, e);
    }
  });
}

// src/shared/storage/storage.js
function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    emit("data:saved", { key });
  } catch (e) {
    console.error("Save error:", e);
  }
}

// src/shared/storage/keys.js
var K = {
  // CW (contract worker)
  cwEmp: "sep_cw_emp_v2",
  cwAtt: "sep_cw_att_v2",
  cwCfg: "sep_cw_cfg_v2",
  cwPay: "sep_cw_pay_v2",
  cwAdv: "sep_cw_adv_v1",
  // Perm (permanent staff)
  peEmp: "sep_pe_emp_v1",
  peAtt: "sep_pe_att_v1",
  pePay: "sep_pe_pay_v1",
  peAdv: "sep_pe_adv_v1",
  // Stock
  stock: "sep_stock_v1",
  stockLog: "sep_stock_log_v1",
  // Production
  prodLog: "sep_prod_log_v1",
  prodAreas: "sep_prod_areas_v1",
  prodCfg: "sep_prod_cfg_v1",
  permSnack: "sep_perm_snack_log_v1",
  // System
  settings: "sep_settings_v1",
  version: "sep_data_version",
  // Month lock
  monthLock: "sep_month_lock_v1",
  // Invoice
  clients: "sep_clients_v1",
  rates: "sep_rates_v1",
  invoices: "sep_inv_v1",
  invCfg: "sep_inv_cfg_v1"
};

// src/shared/storage/state.js
var _state = {
  currentTab: "home",
  today: localDateStr(),
  histDate: localDateStr(),
  attFilter: "all",
  // all | perm | cw
  darkMode: false,
  settingsOpen: false,
  invTab: "list",
  // list | clients | gst
  invMonth: (() => {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })(),
  pickerPeriod: null,
  pickerArea: null
};
function getState() {
  return _state;
}
function setState(patch) {
  Object.assign(_state, patch);
  return _state;
}

// src/shared/config/workers.js
var DEF_PERM = [
  { id: "shyam_bera", name: "Shyam", role: "Production Supervisor", dailyRate: 576, inactive: false },
  { id: "sharat_mahato", name: "Sharat", role: "VAT A1 Lead", dailyRate: 496, inactive: false },
  { id: "sunil_mahato", name: "Sunil", role: "Barrel Lead", dailyRate: 496, inactive: false },
  { id: "rupa_bera", name: "Rupa", role: "VAT A2 Lead", dailyRate: 496, inactive: false },
  { id: "bp_sharma", name: "Bhanu", role: "Worker", dailyRate: 496, inactive: false },
  { id: "lk_das", name: "Lucky", role: "Worker", dailyRate: 496, inactive: false },
  { id: "lal", name: "Lal", role: "Worker", dailyRate: 496, inactive: false },
  { id: "suklal", name: "Suklal", role: "Pickling Lead", dailyRate: 440, inactive: false },
  { id: "uday", name: "Uday", role: "Guard", dailyRate: 360, inactive: false },
  { id: "rounak", name: "Rounak", role: "Data Admin", dailyRate: 0, inactive: true }
];
var DEF_CW = [
  { id: "kusu", name: "Kusu", inactive: false },
  { id: "sripati", name: "Sripati", inactive: false },
  { id: "naren", name: "Naren", inactive: false },
  { id: "champai", name: "Champai", inactive: false },
  { id: "budheswar", name: "Budheswar", inactive: false },
  { id: "sai", name: "Sai", inactive: false },
  { id: "shambhu", name: "Shambhu", inactive: false },
  { id: "mantu", name: "Mantu", inactive: false },
  { id: "rocky", name: "Rocky", inactive: false },
  { id: "birsa", name: "Birsa", inactive: false },
  { id: "tuklu", name: "Tuklu", inactive: false }
];

// src/shared/config/areas.js
var DEF_AREAS = [
  {
    id: "vat_a1",
    name: "VAT A1",
    group: "vat",
    dep: false,
    depOn: [],
    caps: [
      { l: 0, lb: "Off", r: 0 },
      { l: 33, lb: "33%", r: 3 },
      { l: 66, lb: "66%", r: 4 },
      { l: 100, lb: "100%", r: 5 }
    ],
    roster: ["sharat_mahato", "bp_sharma", "lk_das", "lal", "suklal"]
  },
  {
    id: "vat_a2",
    name: "VAT A2",
    group: "vat",
    dep: false,
    depOn: [],
    caps: [
      { l: 0, lb: "Off", r: 0 },
      { l: 25, lb: "25%", r: 2 },
      { l: 50, lb: "50%", r: 3 },
      { l: 75, lb: "75%", r: 4 },
      { l: 100, lb: "100%", r: 4 }
    ],
    roster: ["sharat_mahato", "sai", "shambhu", "mantu"]
  },
  {
    id: "barrel",
    name: "Barrel",
    group: "barrel",
    dep: false,
    depOn: [],
    caps: [
      { l: 0, lb: "Off", r: 0 },
      { l: 25, lb: "25%", r: 2 },
      { l: 50, lb: "50%", r: 2 },
      { l: 75, lb: "75%", r: 3 },
      { l: 100, lb: "100%", r: 3 }
    ],
    roster: ["sunil_mahato", "birsa", "tuklu"]
  },
  {
    id: "pickle_vat",
    name: "Pickling (VAT)",
    group: "vat",
    dep: true,
    depOn: ["vat_a1", "vat_a2"],
    caps: [],
    roster: ["lk_das", "lal", "suklal"]
  },
  {
    id: "pickle_barrel",
    name: "Pickling (Barrel)",
    group: "barrel",
    dep: true,
    depOn: ["barrel"],
    caps: [],
    roster: ["rupa_bera", "bp_sharma"]
  }
];

// src/shared/config/wage.js
var DEF_CFG = {
  hourRate: 41.25,
  snackRate: 20,
  permOtMultiplier: 1.1,
  permOtBaseRate: 496,
  guardIds: ["uday"],
  excludedIds: ["rounak"],
  standardShift: { start: "08:30", end: "17:00", hours: 8 },
  sundayHolidayShift: { start: "06:00", end: "14:00", hours: 8 },
  morningOT: { start: "06:00", end: "08:30", hours: 3 },
  eveningOT: { start: "17:00", end: "20:00", hours: 3 }
};

// src/shared/config/stock.js
var DEF_STOCK = [
  { id: "zinc_anodes", name: "Zinc Anodes", unit: "kg", qty: 0, threshold: 50, category: "chemical" },
  { id: "growel_1728", name: "Growel 1728", unit: "L", qty: 0, threshold: 10, category: "chemical" },
  { id: "sodium_cyanide", name: "Sodium Cyanide", unit: "kg", qty: 0, threshold: 20, maxQty: 100, category: "chemical" },
  { id: "sodium_hydroxide", name: "Sodium Hydroxide", unit: "kg", qty: 0, threshold: 30, category: "chemical" },
  { id: "brightener", name: "Brightener", unit: "L", qty: 0, threshold: 5, category: "chemical" },
  { id: "hcl", name: "HCl", unit: "L", qty: 0, threshold: 20, category: "chemical" }
];

// src/shared/config/invoice.js
var DEF_INV_CFG = {
  companyName: "Soma Electro Products",
  gstin: "",
  stateCode: "20",
  // Jharkhand
  sac: "998871",
  // Job work — electroplating
  gstRate: 18,
  // 18% total (9+9 CGST+SGST or 18 IGST)
  seriesPrefix: "SEP",
  nextNumber: 1,
  bankName: "",
  bankAccount: "",
  bankIFSC: ""
};

// src/components/save-dot.js
var saveDotTimer = null;
function initSaveDot() {
  on("data:saved", () => {
    const dot = document.getElementById("saveDot");
    if (!dot) return;
    dot.classList.add("show");
    dot.classList.remove("unsaved");
    clearTimeout(saveDotTimer);
    saveDotTimer = setTimeout(() => dot.classList.remove("show"), 2e3);
  });
}

// src/shared/storage/settings.js
function getSettings() {
  return loadJSON(K.settings, { darkMode: false, swipeTabs: true });
}

// src/components/dark-mode.js
function toggleDarkMode() {
  const next = !getState().darkMode;
  setState({ darkMode: next });
  document.documentElement.classList.toggle("dark", next);
  const s = getSettings();
  s.darkMode = next;
  saveJSON(K.settings, s);
}
function initDarkMode() {
  const dark = getSettings().darkMode || false;
  setState({ darkMode: dark });
  document.documentElement.classList.toggle("dark", dark);
}

// src/components/fab.js
var fabOpen = false;
function toggleFab() {
  fabOpen = !fabOpen;
  document.getElementById("fabBtn")?.classList.toggle("open", fabOpen);
  document.getElementById("fabMenu")?.classList.toggle("open", fabOpen);
}
function closeFab() {
  fabOpen = false;
  document.getElementById("fabBtn")?.classList.remove("open");
  document.getElementById("fabMenu")?.classList.remove("open");
}
function initFab(actions) {
  document.addEventListener("click", (e) => {
    if (fabOpen && !e.target.closest(".fab-container")) closeFab();
  });
  return function fabAction(action) {
    closeFab();
    const fn = actions[action];
    if (typeof fn === "function") fn();
  };
}

// src/shared/storage/production.js
function getAreas() {
  return loadJSON(K.prodAreas, DEF_AREAS);
}
function getCfg() {
  const saved = loadJSON(K.prodCfg, {});
  return {
    ...DEF_CFG,
    ...saved,
    standardShift: { ...DEF_CFG.standardShift, ...saved.standardShift || {} },
    sundayHolidayShift: { ...DEF_CFG.sundayHolidayShift, ...saved.sundayHolidayShift || {} },
    morningOT: { ...DEF_CFG.morningOT, ...saved.morningOT || {} },
    eveningOT: { ...DEF_CFG.eveningOT, ...saved.eveningOT || {} }
  };
}
function getProdLogs() {
  return loadJSON(K.prodLog, {});
}
function getProdDay(date) {
  const logs = getProdLogs();
  return logs[date] || null;
}
function saveProdDay(date, dayData) {
  const logs = getProdLogs();
  logs[date] = dayData;
  saveJSON(K.prodLog, logs);
}

// src/shared/storage/workers.js
function getPermWorkers() {
  return loadJSON(K.peEmp, DEF_PERM);
}
function getCWWorkers() {
  return loadJSON(K.cwEmp, DEF_CW);
}
function getActivePermProd() {
  return getPermWorkers().filter(
    (w) => !w.inactive && !DEF_CFG.guardIds.includes(w.id) && !DEF_CFG.excludedIds.includes(w.id)
  );
}
function getActiveCW() {
  return getCWWorkers().filter((w) => !w.inactive);
}
function getGuards() {
  return getPermWorkers().filter(
    (w) => DEF_CFG.guardIds.includes(w.id) && !w.inactive
  );
}
function getAllProdWorkers() {
  const perm = getActivePermProd().map((w) => ({ ...w, type: "perm" }));
  const cw = getActiveCW().map((w) => ({ ...w, type: "cw" }));
  return [...perm, ...cw];
}
function findWorker(id) {
  const all = [
    ...getPermWorkers().map((w) => ({ ...w, type: "perm" })),
    ...getCWWorkers().map((w) => ({ ...w, type: "cw" }))
  ];
  return all.find((w) => w.id === id) || { id, name: id, type: "cw" };
}

// src/shared/storage/lock.js
function getMonthLocks() {
  return loadJSON(K.monthLock, {});
}
function isMonthLocked(month) {
  const locks = getMonthLocks();
  return locks[month]?.locked === true;
}
function requireUnlocked(month, label) {
  if (isMonthLocked(month)) {
    alert(`\u{1F512} ${month} is locked \u2014 ${label || "this change"} is blocked. Unlock the month from the Finance tab to edit.`);
    return true;
  }
  return false;
}

// src/shared/utils/month.js
function monthOf(dateStr) {
  return dateStr.slice(0, 7);
}
function monthDates(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const out = [];
  for (let d = 1; d <= days; d++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

// src/shared/utils/currency.js
function sepRound(n) {
  return Math.floor(Number(n) || 0);
}
function formatCurrency(n) {
  return "\u20B9" + sepRound(n).toLocaleString("en-IN");
}

// src/shared/utils/calc-prod.js
function initProdDay() {
  return {
    periods: {
      morningOT: { active: false, hours: 3, areas: {}, workers: [] },
      standard: { active: true, hours: 8, areas: {}, workers: null },
      eveningOT: { active: false, hours: 3, areas: {}, workers: [] }
    },
    totals: { pieces: 0, weight: 0, extraHours: 0, extraCost: 0, snackCost: 0 },
    confirmed: false,
    timeline: []
  };
}
function getReq(areaId, periodKey, prod, areas) {
  const a = areas.find((x) => x.id === areaId);
  if (!a) return 0;
  const pa = prod.periods[periodKey]?.areas?.[areaId];
  if (!pa) return 0;
  if (!a.dep) {
    if (pa.cap === 0) return 0;
    const cl = a.caps.find((c) => c.l === pa.cap);
    return cl ? cl.r : 0;
  }
  if (areaId === "pickle_vat") {
    const a1c = prod.periods[periodKey].areas.vat_a1?.cap || 0;
    const a2c = prod.periods[periodKey].areas.vat_a2?.cap || 0;
    if (a1c === 0 && a2c === 0) return 0;
    if (a1c === 100 && a2c === 100) return 3;
    return 2;
  }
  if (areaId === "pickle_barrel") {
    const bc = prod.periods[periodKey].areas.barrel?.cap || 0;
    if (bc === 0) return 0;
    if (bc <= 50) return 1;
    return 2;
  }
  return 0;
}
function recalcExtra(prod, areas, cfg) {
  let totalExtraH = 0;
  let totalExtraCost = 0;
  ["morningOT", "standard", "eveningOT"].forEach((pk) => {
    const period = prod.periods[pk];
    if (!period || pk !== "standard" && !period.active) return;
    const hours = period.hours || (pk === "standard" ? 8 : 3);
    let shortfall = 0;
    areas.forEach((area) => {
      const pa = period.areas?.[area.id];
      if (!pa) return;
      const req = getReq(area.id, pk, prod, areas);
      const assigned = pa.assigned?.length || 0;
      if (req > assigned) shortfall += req - assigned;
    });
    const periodExtra = sepRound(shortfall * hours * cfg.hourRate);
    totalExtraH += shortfall * hours;
    totalExtraCost += periodExtra;
  });
  let snackCost = 0;
  const eveningOT = prod.periods.eveningOT;
  if (eveningOT?.active) {
    const snackWorkers = eveningOT.workers?.length || 0;
    snackCost = snackWorkers * cfg.snackRate;
  }
  prod.totals = prod.totals || {};
  prod.totals.extraHours = totalExtraH;
  prod.totals.extraCost = totalExtraCost;
  prod.totals.snackCost = snackCost;
}

// src/shared/utils/format.js
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// src/shared/utils/dom.js
function da(action, ...args) {
  if (args.length === 0) return `data-action="${action}"`;
  const json = JSON.stringify(args).replaceAll('"', "&quot;");
  return `data-action="${action}" data-args="${json}"`;
}
function overlayClose(action) {
  return `data-overlay-close="${action}"`;
}

// src/components/worker-picker.js
function openPicker(periodKey, areaId) {
  if (document.querySelector(".picker-overlay")) return;
  history.pushState({ popup: "picker" }, "");
  setState({ pickerPeriod: periodKey, pickerArea: areaId });
  const date = getState().today;
  const prod = getProdDay(date);
  const areas = getAreas();
  const area = areas.find((a) => a.id === areaId);
  const period = prod.periods[periodKey];
  const pa = period.areas[areaId] || { assigned: [] };
  const present = prod.present || [];
  const perm = present.map((id) => findWorker(id)).filter((w) => w.type === "perm");
  const cw = present.map((id) => findWorker(id)).filter((w) => w.type === "cw");
  function workerRow(w) {
    const isAssigned = pa.assigned.includes(w.id);
    let otherAreaName = "";
    if (!isAssigned) {
      for (const [aid, aData] of Object.entries(period.areas || {})) {
        if (aid !== areaId && aData.assigned?.includes(w.id)) {
          otherAreaName = areas.find((a) => a.id === aid)?.name || aid;
          break;
        }
      }
    }
    const disabled = otherAreaName ? "disabled" : "";
    const checked = isAssigned ? "checked" : "";
    return `<div class="picker-worker ${checked} ${disabled}" ${da("togglePickerWorker", w.id)}>
      <div class="picker-check">\u2713</div>
      <span class="picker-name">${esc(w.name)}</span>
      ${otherAreaName ? `<span class="picker-where">\u2192 ${esc(otherAreaName)}</span>` : ""}
    </div>`;
  }
  const html = `<div class="picker-overlay" ${overlayClose("closePicker")}>
    <div class="picker-sheet">
      <div class="picker-header">
        <span class="card-title">${esc(area?.name || areaId)} \u2014 Workers</span>
        <button class="header-btn" ${da("closePicker")}>\u2715</button>
      </div>
      <div class="picker-body" id="pickerBody">
        <div class="picker-section-label">Permanent Staff</div>
        ${perm.map((w) => workerRow(w)).join("")}
        <div class="picker-section-label">Contract Workers</div>
        ${cw.map((w) => workerRow(w)).join("")}
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
function togglePickerWorker(workerId) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "worker assignment")) return;
  const prod = getProdDay(date);
  const period = prod.periods[getState().pickerPeriod];
  const pa = period.areas[getState().pickerArea];
  if (!pa) return;
  const idx = pa.assigned.indexOf(workerId);
  if (idx >= 0) pa.assigned.splice(idx, 1);
  else pa.assigned.push(workerId);
  recalcExtra(prod, getAreas(), getCfg());
  saveProdDay(date, prod);
  closePicker();
  openPicker(getState().pickerPeriod, getState().pickerArea);
  if (typeof window.renderProduction === "function") window.renderProduction();
}
function closePicker() {
  const el = document.querySelector(".picker-overlay");
  if (el) el.remove();
}

// src/shared/storage/invoice.js
function getClients() {
  return loadJSON(K.clients, []);
}
function getRates() {
  return loadJSON(K.rates, []);
}
function getInvoices() {
  return loadJSON(K.invoices, []);
}
function getInvCfg() {
  return { ...DEF_INV_CFG, ...loadJSON(K.invCfg, {}) };
}
function getClientRates(clientId) {
  return getRates().filter((r) => r.clientId === clientId);
}
function getFY(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const fy1 = m >= 3 ? y : y - 1;
  return `${fy1}-${String(fy1 + 1).slice(-2)}`;
}
function genInvNumber() {
  const cfg = getInvCfg();
  const fy = getFY(getState().today);
  const num = String(cfg.nextNumber).padStart(4, "0");
  return `${cfg.seriesPrefix}/${fy}/${num}`;
}

// src/components/settings-panel.js
function getStorageUsed() {
  let total = 0;
  Object.values(K).forEach((key) => {
    if (typeof key === "function") return;
    const v = localStorage.getItem(key);
    if (v) total += key.length + v.length;
  });
  return (total * 2 / 1024).toFixed(1) + " KB";
}
function exportData() {
  const data = {};
  Object.entries(K).forEach(([_label, key]) => {
    if (typeof key === "function") return;
    const v = localStorage.getItem(key);
    if (v) data[key] = JSON.parse(v);
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = getState().today;
  a.href = url;
  a.download = `SEP_Backup_${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    try {
      const text = await e.target.files[0].text();
      const data = JSON.parse(text);
      Object.entries(data).forEach(([key, val]) => {
        localStorage.setItem(key, JSON.stringify(val));
      });
      alert("Import successful. Reloading...");
      location.reload();
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  input.click();
}
function resetAllData() {
  if (!confirm("Reset ALL data? This cannot be undone.")) return;
  localStorage.clear();
  location.reload();
}
function openSettings() {
  if (document.querySelector(".settings-overlay")) return;
  history.pushState({ popup: "settings" }, "");
  const perm = getPermWorkers();
  const cw = getCWWorkers();
  const _settings = getSettings();
  const cfg = getCfg();
  const invCfg = getInvCfg();
  const html = `<div class="settings-overlay" ${overlayClose("closeSettings")}>
    <div class="settings-panel">
      <div class="flex-between" style="padding:var(--sp-12) var(--sp-16);border-bottom:1px solid var(--border)">
        <span class="card-title">Settings</span>
        <button class="header-btn" ${da("closeSettings")}>\u2715</button>
      </div>
      <div class="settings-body">

        <div class="section-zone">
          <div class="section-label-md">General</div>
          <div class="card-info">
            <div class="settings-row"><span class="card-label">Version</span><span class="card-meta">v${APP_VERSION}</span></div>
            <div class="settings-row"><span class="card-label">CW Hour Rate</span><span class="card-meta">\u20B9${cfg.hourRate}/hr</span></div>
            <div class="settings-row"><span class="card-label">Snack Rate</span><span class="card-meta">\u20B9${cfg.snackRate}/day</span></div>
            <div class="settings-row"><span class="card-label">Perm OT Base</span><span class="card-meta">\u20B9${cfg.permOtBaseRate}/day \u2192 \u20B9${sepRound(cfg.permOtBaseRate / 8 * cfg.permOtMultiplier)}/hr</span></div>
          </div>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Permanent Staff (${perm.length})</div>
          <div class="card-info">
            ${perm.map((w) => `<div class="settings-row">
              <div>
                <span class="card-label">${esc(w.name)}</span>
                <span class="card-meta"> \u2014 ${w.role || "Worker"}${w.inactive ? " (inactive)" : ""}</span>
              </div>
              <span class="card-meta">\u20B9${w.dailyRate}/day</span>
            </div>`).join("")}
          </div>
          <button class="btn btn-secondary btn-sm mt-8" ${da("addWorkerPrompt", "perm")}>+ Add Perm Worker</button>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Contract Workers (${cw.filter((w) => !w.inactive).length} active)</div>
          <div class="card-info">
            ${cw.filter((w) => !w.inactive).map((w) => `<div class="settings-row">
              <span class="card-label">${esc(w.name)}</span>
              <button class="btn btn-sm" style="color:var(--danger)" ${da("toggleWorkerActive", "cw", w.id)}>Deactivate</button>
            </div>`).join("")}
            ${cw.filter((w) => w.inactive).length ? `<div class="card-meta mt-8">Inactive: ${cw.filter((w) => w.inactive).map((w) => `${w.name}${w.deactivatedOn ? " (" + formatDateShort(w.deactivatedOn) + ")" : ""}`).join(", ")}</div>
            <div class="mt-4">${cw.filter((w) => w.inactive).map((w) => `<button class="btn btn-sm btn-secondary mt-4" ${da("toggleWorkerActive", "cw", w.id)}>Reactivate ${esc(w.name)}</button>`).join(" ")}</div>` : ""}
          </div>
          <button class="btn btn-secondary btn-sm mt-8" ${da("addWorkerPrompt", "cw")}>+ Add CW Worker</button>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Invoice Settings</div>
          <div class="card-info">
            <div class="settings-row"><span class="card-label">Company</span><span class="card-meta">${esc(invCfg.companyName)}</span></div>
            <div class="settings-row"><span class="card-label">GSTIN</span><span class="card-meta">${esc(invCfg.gstin || "Not set")}</span></div>
            <div class="settings-row"><span class="card-label">State Code</span><span class="card-meta">${invCfg.stateCode}</span></div>
            <div class="settings-row"><span class="card-label">SAC</span><span class="card-meta">${invCfg.sac}</span></div>
            <div class="settings-row"><span class="card-label">GST Rate</span><span class="card-meta">${invCfg.gstRate}%</span></div>
            <div class="settings-row"><span class="card-label">Next Invoice #</span><span class="card-meta">${invCfg.seriesPrefix}/.../\u200B${String(invCfg.nextNumber).padStart(4, "0")}</span></div>
          </div>
          <button class="btn btn-secondary btn-sm mt-8" ${da("editInvConfig")}>Edit Invoice Config</button>
        </div>

        <div class="section-zone">
          <div class="section-label-md">Data Management</div>
          <div class="card-info">
            <div class="settings-row">
              <span class="card-label">Storage Used</span>
              <span class="card-meta">${getStorageUsed()}</span>
            </div>
          </div>
          <div class="flex-center gap-8 mt-8">
            <button class="btn btn-secondary btn-sm" ${da("exportData")}>Export JSON</button>
            <button class="btn btn-secondary btn-sm" ${da("importData")}>Import JSON</button>
          </div>
          <button class="btn btn-danger btn-sm mt-8 btn-full" ${da("resetAllData")}>Reset All Data</button>
        </div>

      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
function closeSettings() {
  const el = document.querySelector(".settings-overlay");
  if (el) el.remove();
}
function addWorkerPrompt(type) {
  const name = prompt(`Enter ${type === "perm" ? "permanent" : "contract"} worker name:`);
  if (!name || !name.trim()) return;
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36).slice(-4);
  if (type === "perm") {
    const rate = prompt("Daily rate (\u20B9):", "496");
    const dailyRate = parseInt(rate) || 496;
    const role = prompt("Role:", "Worker");
    const workers = getPermWorkers();
    workers.push({ id, name: name.trim(), role: role || "Worker", dailyRate, inactive: false });
    saveJSON(K.peEmp, workers);
  } else {
    const workers = getCWWorkers();
    workers.push({ id, name: name.trim(), inactive: false });
    saveJSON(K.cwEmp, workers);
  }
  closeSettings();
  openSettings();
}
function toggleWorkerActive(type, id) {
  const key = type === "perm" ? K.peEmp : K.cwEmp;
  const workers = loadJSON(key, []);
  const w = workers.find((x) => x.id === id);
  if (!w) return;
  if (!w.inactive) {
    const reason = prompt("Reason for deactivation (optional):", "") || "";
    if (!confirm(`Deactivate ${w.name}?`)) return;
    w.inactive = true;
    w.deactivatedOn = getState().today;
    w.deactivateReason = reason;
  } else {
    if (!confirm(`Reactivate ${w.name}?`)) return;
    w.inactive = false;
    w.reactivatedOn = getState().today;
  }
  saveJSON(key, workers);
  closeSettings();
  openSettings();
}
function initSettingsBackHandler() {
  window.addEventListener("popstate", () => {
    closeSettings();
  });
}

// src/shared/utils/payroll.js
function getAttKey(type, id, date) {
  return `${id}_${date.replace(/-/g, "_")}`;
}
function calcDayWages({
  date,
  cfg,
  cwAtt,
  peAtt,
  activeCW,
  activePermProd,
  guards
}) {
  let total = 0;
  for (const w of activeCW) {
    const k = getAttKey("cw", w.id, date);
    const rec = cwAtt[k];
    if (!rec || rec.status === "A") continue;
    let hours = cfg.standardShift.hours;
    if (rec.otHours) hours += rec.otHours;
    total += sepRound(hours * cfg.hourRate);
  }
  for (const w of activePermProd) {
    const k = getAttKey("perm", w.id, date);
    const rec = peAtt[k];
    if (!rec || rec.status === "A") continue;
    total += w.dailyRate;
    if (rec.otHours && rec.otHours > 0) {
      const otRate = sepRound(cfg.permOtBaseRate / 8 * cfg.permOtMultiplier);
      total += sepRound(rec.otHours * otRate);
    }
  }
  for (const w of guards) {
    const k = getAttKey("perm", w.id, date);
    const rec = peAtt[k];
    if (rec && rec.status !== "A") total += w.dailyRate;
  }
  return total;
}
function calcMonthWages({
  date,
  today,
  cfg,
  cwAtt,
  peAtt,
  activeCW,
  activePermProd,
  guards
}) {
  const d = /* @__PURE__ */ new Date(date + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const todayDay = (/* @__PURE__ */ new Date(today + "T00:00:00")).getDate();
  let total = 0;
  for (let i = 1; i <= todayDay; i++) {
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    total += calcDayWages({
      date: ds,
      cfg,
      cwAtt,
      peAtt,
      activeCW,
      activePermProd,
      guards
    });
  }
  return total;
}
function calcCWWeeklyPay({
  satDate,
  cfg,
  cwAtt,
  cwAdv,
  prodLogs,
  permSnacks,
  activeCW
}) {
  const sat = /* @__PURE__ */ new Date(satDate + "T00:00:00");
  const mon = new Date(sat);
  mon.setDate(mon.getDate() - 5);
  const workers = activeCW.map((w) => {
    let days = 0;
    let hours = 0;
    let otH = 0;
    let wage = 0;
    for (let d = new Date(mon); d <= sat; d.setDate(d.getDate() + 1)) {
      const ds = localDateStr(d);
      const k = getAttKey("cw", w.id, ds);
      const rec = cwAtt[k];
      if (!rec || rec.status === "A") continue;
      days++;
      const dayH = cfg.standardShift.hours + (rec.otHours || 0);
      hours += dayH;
      otH += rec.otHours || 0;
      wage += sepRound(dayH * cfg.hourRate);
    }
    const advKey = `${w.id}_${satDate}`;
    const advance = cwAdv[advKey] || 0;
    return { id: w.id, name: w.name, days, hours, otH, wage, advance, net: wage - advance };
  });
  let extraTotal = 0;
  let snackTotal = 0;
  for (let d = new Date(mon); d <= sat; d.setDate(d.getDate() + 1)) {
    const ds = localDateStr(d);
    const prod = prodLogs[ds];
    extraTotal += prod?.totals?.extraCost || 0;
    snackTotal += prod?.totals?.snackCost || 0;
  }
  const weekSnacks = (permSnacks || []).filter((s) => s.week === satDate);
  const permSnackTotal = weekSnacks.reduce((sum, s) => sum + (s.snack || 0), 0);
  const cwWageTotal = workers.reduce((s, w) => s + w.wage, 0);
  const cwAdvTotal = workers.reduce((s, w) => s + w.advance, 0);
  const grandTotal = cwWageTotal - cwAdvTotal + extraTotal + snackTotal + permSnackTotal;
  return {
    workers,
    cwWageTotal,
    cwAdvTotal,
    extraTotal,
    snackTotal,
    permSnackTotal,
    grandTotal,
    satDate,
    monDate: localDateStr(mon)
  };
}
function calcPermMonthlyPay({
  date,
  today,
  cfg,
  peAtt,
  peAdv,
  activePermProd,
  guards,
  guardIds
}) {
  const d = /* @__PURE__ */ new Date(date + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const todayDay = (/* @__PURE__ */ new Date(today + "T00:00:00")).getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const all = [...activePermProd, ...guards];
  const workers = all.map((w) => {
    let days = 0;
    let otH = 0;
    let basePay = 0;
    let otPay = 0;
    for (let i = 1; i <= Math.min(todayDay, daysInMonth); i++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const k = getAttKey("perm", w.id, ds);
      const rec = peAtt[k];
      if (!rec || rec.status === "A") continue;
      days++;
      basePay += w.dailyRate;
      if (rec.otHours && rec.otHours > 0 && !guardIds.includes(w.id)) {
        const rate = sepRound(cfg.permOtBaseRate / 8 * cfg.permOtMultiplier);
        otPay += sepRound(rec.otHours * rate);
        otH += rec.otHours;
      }
    }
    const advKey = `${w.id}_${y}_${m + 1}`;
    const advance = peAdv[advKey] || 0;
    return {
      id: w.id,
      name: w.name,
      role: w.role,
      days,
      otH,
      basePay,
      otPay,
      advance,
      total: basePay + otPay - advance
    };
  });
  const grandTotal = workers.reduce((s, w) => s + w.total, 0);
  return {
    workers,
    grandTotal,
    month: `${y}-${String(m + 1).padStart(2, "0")}`,
    daysInMonth
  };
}

// src/components/print-pay.js
function cwWeekly(satDate) {
  return calcCWWeeklyPay({
    satDate,
    cfg: getCfg(),
    cwAtt: loadJSON(K.cwAtt, {}),
    cwAdv: loadJSON(K.cwAdv, {}),
    prodLogs: getProdLogs(),
    permSnacks: loadJSON(K.permSnack, []),
    activeCW: getActiveCW()
  });
}
function permMonthly(date) {
  return calcPermMonthlyPay({
    date,
    today: getState().today,
    cfg: getCfg(),
    peAtt: loadJSON(K.peAtt, {}),
    peAdv: loadJSON(K.peAdv, {}),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
    guardIds: DEF_CFG.guardIds
  });
}
var PRINT_CSS = `body{font-family:Arial,sans-serif;padding:20px;color:#000} .print-header{text-align:center;border-bottom:2px solid #000;padding-bottom:8pt;margin-bottom:12pt} .print-footer{margin-top:24pt;border-top:1px solid #999;padding-top:8pt} .print-sig{display:flex;justify-content:space-between;margin-top:32pt} .print-sig div{border-top:1px solid #000;padding-top:4pt;width:30%;text-align:center;font-size:9pt}`;
function printCWPay() {
  const satDate = getWeekEnd(getState().today);
  const data = cwWeekly(satDate);
  const cfg = getInvCfg();
  let html = `<div class="print-header"><h2>${esc(cfg.companyName)}</h2>
    <p>CW Weekly Pay \u2014 ${formatDateShort(data.monDate)} to ${formatDateShort(data.satDate)}</p></div>`;
  html += '<table style="width:100%;border-collapse:collapse;font-size:10pt;margin-top:12pt">';
  html += '<tr style="border-bottom:2px solid #000"><th style="text-align:left;padding:4pt">Name</th><th>Days</th><th>OT Hrs</th><th>Gross</th><th>Advance</th><th style="text-align:right">Net</th></tr>';
  data.workers.filter((w2) => w2.days > 0).forEach((w2) => {
    html += `<tr style="border-bottom:1px solid #ccc"><td style="padding:4pt">${esc(w2.name)}</td><td style="text-align:center">${w2.days}</td><td style="text-align:center">${w2.otH || 0}</td><td style="text-align:right;font-family:monospace">${formatCurrency(w2.wage)}</td><td style="text-align:right;font-family:monospace">${w2.advance ? formatCurrency(w2.advance) : "\u2014"}</td><td style="text-align:right;font-family:monospace;font-weight:600">${formatCurrency(w2.net)}</td></tr>`;
  });
  const advTotal = data.workers.reduce((s, w2) => s + w2.advance, 0);
  html += `<tr style="border-top:2px solid #000;font-weight:700"><td colspan="3" style="padding:4pt">Total</td><td style="text-align:right;font-family:monospace">${formatCurrency(data.cwWageTotal)}</td><td style="text-align:right;font-family:monospace">${formatCurrency(advTotal)}</td><td style="text-align:right;font-family:monospace">${formatCurrency(data.grandTotal)}</td></tr>`;
  html += "</table>";
  if (data.extraTotal) html += `<p style="font-size:9pt;margin-top:8pt">Extra (shortfall): ${formatCurrency(data.extraTotal)} | Snack: ${formatCurrency(data.snackTotal + data.permSnackTotal)}</p>`;
  html += `<div class="print-footer"><div class="print-sig"><div>Prepared By</div><div>Verified By</div><div>Approved By</div></div></div>`;
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) {
    alert("Popup blocked.");
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><title>CW Pay - ${data.satDate}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
}
function printPermPay() {
  const data = permMonthly(getState().today);
  const cfg = getInvCfg();
  const monthLabel = (/* @__PURE__ */ new Date(data.month + "-01T00:00:00")).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  let html = `<div class="print-header"><h2>${esc(cfg.companyName)}</h2>
    <p>Permanent Staff Monthly Pay \u2014 ${monthLabel}</p></div>`;
  html += '<table style="width:100%;border-collapse:collapse;font-size:10pt;margin-top:12pt">';
  html += '<tr style="border-bottom:2px solid #000"><th style="text-align:left;padding:4pt">Name</th><th>Role</th><th>Days</th><th>OT Hrs</th><th>Base</th><th>OT Pay</th><th>Advance</th><th style="text-align:right">Net</th></tr>';
  data.workers.filter((w2) => w2.days > 0).forEach((w2) => {
    html += `<tr style="border-bottom:1px solid #ccc"><td style="padding:4pt">${esc(w2.name)}</td><td style="font-size:9pt">${esc(w2.role || "")}</td><td style="text-align:center">${w2.days}</td><td style="text-align:center">${w2.otH || 0}</td><td style="text-align:right;font-family:monospace">${formatCurrency(w2.basePay)}</td><td style="text-align:right;font-family:monospace">${formatCurrency(w2.otPay)}</td><td style="text-align:right;font-family:monospace">${w2.advance ? formatCurrency(w2.advance) : "\u2014"}</td><td style="text-align:right;font-family:monospace;font-weight:600">${formatCurrency(w2.total)}</td></tr>`;
  });
  html += `<tr style="border-top:2px solid #000;font-weight:700"><td colspan="7" style="padding:4pt">Total</td><td style="text-align:right;font-family:monospace">${formatCurrency(data.grandTotal)}</td></tr>`;
  html += "</table>";
  html += `<div class="print-footer"><div class="print-sig"><div>Prepared By</div><div>Verified By</div><div>Approved By</div></div></div>`;
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) {
    alert("Popup blocked.");
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><title>Perm Pay - ${data.month}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
}

// src/components/invoice-form.js
function openInvoiceModal() {
  const clients = getClients().filter((c) => !c.inactive);
  if (clients.length === 0) {
    alert("Add a client first (go to Clients tab).");
    return;
  }
  const clientOpts = clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const html = `<div class="inv-modal-overlay" id="invModalOverlay" ${overlayClose("closeInvModal")}>
    <div class="inv-modal">
      <div class="flex-between mb-16">
        <div class="card-title" style="font-size:var(--fs-lg)">New Invoice</div>
        <button class="header-btn" ${da("closeInvModal")} style="font-size:var(--fs-lg)">\u2715</button>
      </div>

      <div class="form-group">
        <label>Client</label>
        <select id="invFormClient" onchange="onInvClientChange()">
          <option value="">\u2014 Select client \u2014</option>
          ${clientOpts}
        </select>
      </div>

      <div class="form-group">
        <label>Invoice Date</label>
        <input type="date" id="invFormDate" value="${getState().today}">
      </div>

      <div class="form-group">
        <label>Line Items</label>
        <div id="invFormLines"></div>
        <button class="btn btn-secondary btn-sm mt-8" ${da("addInvLine")}>+ Add Line</button>
      </div>

      <div class="inv-tax-preview" id="invTaxPreview">
        <div class="card-meta">Select a client and add items to see totals</div>
      </div>

      <div class="flex-center gap-8 mt-16">
        <button class="btn btn-secondary" style="flex:1" ${da("closeInvModal")}>Cancel</button>
        <button class="btn btn-primary" style="flex:2" ${da("submitInvoiceForm")}>Create Invoice</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  addInvLine();
}
function closeInvModal() {
  const el = document.getElementById("invModalOverlay");
  if (el) el.remove();
}
function onInvClientChange() {
  const clientId = document.getElementById("invFormClient").value;
  if (!clientId) return;
  const lines = document.querySelectorAll(".inv-line-item");
  lines.forEach((line) => {
    const sel = line.querySelector(".inv-rate-select");
    if (sel) updateRateDropdown(sel, clientId);
  });
  recalcInvPreview();
}
function updateRateDropdown(sel, clientId) {
  const rates = getClientRates(clientId);
  let opts = '<option value="">Custom item</option>';
  rates.forEach((r) => {
    opts += `<option value="${r.id}">${esc(r.material)} \u2014 \u20B9${r.rate}/${r.unit}</option>`;
  });
  sel.innerHTML = opts;
}
function addInvLine() {
  const container = document.getElementById("invFormLines");
  const clientId = document.getElementById("invFormClient").value;
  const lineNum = container.children.length + 1;
  const rates = clientId ? getClientRates(clientId) : [];
  let rateOpts = '<option value="">Custom item</option>';
  rates.forEach((r) => {
    rateOpts += `<option value="${r.id}">${esc(r.material)} \u2014 \u20B9${r.rate}/${r.unit}</option>`;
  });
  const lineHtml = `<div class="inv-line-item" data-line="${lineNum}">
    <div class="line-row">
      <select class="inv-rate-select" style="flex:2" onchange="onRateSelect(this)">
        ${rateOpts}
      </select>
      <input type="text" class="inv-desc" placeholder="Description" style="flex:2">
    </div>
    <div class="line-row">
      <input type="number" class="inv-qty" placeholder="Qty" step="any" min="0" style="flex:1" oninput="recalcInvPreview()">
      <input type="number" class="inv-rate" placeholder="Rate (\u20B9)" step="any" min="0" style="flex:1" oninput="recalcInvPreview()">
      <select class="inv-unit" style="flex:1">
        <option value="kg">kg</option>
        <option value="pc">pc</option>
      </select>
    </div>
    ${lineNum > 1 ? `<div class="inv-line-remove" ${da("removeInvLine")}>Remove</div>` : ""}
  </div>`;
  container.insertAdjacentHTML("beforeend", lineHtml);
}
function removeInvLine() {
  this.parentElement.remove();
  recalcInvPreview();
}
function onRateSelect(sel) {
  const line = sel.closest(".inv-line-item");
  const rateId = sel.value;
  if (!rateId) {
    line.querySelector(".inv-desc").value = "";
    line.querySelector(".inv-rate").value = "";
    return;
  }
  const r = getRates().find((x) => x.id === rateId);
  if (r) {
    line.querySelector(".inv-desc").value = r.material;
    line.querySelector(".inv-rate").value = r.rate;
    line.querySelector(".inv-unit").value = r.unit;
    recalcInvPreview();
  }
}
function recalcInvPreview() {
  const el = document.getElementById("invTaxPreview");
  const clientId = document.getElementById("invFormClient").value;
  if (!clientId) {
    el.innerHTML = '<div class="card-meta">Select a client to see totals</div>';
    return;
  }
  const client = getClients().find((c) => c.id === clientId);
  const cfg = getInvCfg();
  const isInter = client.stateCode !== cfg.stateCode;
  let taxable = 0;
  document.querySelectorAll(".inv-line-item").forEach((line) => {
    const qty = parseFloat(line.querySelector(".inv-qty").value) || 0;
    const rate = parseFloat(line.querySelector(".inv-rate").value) || 0;
    taxable += sepRound(qty * rate);
  });
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (isInter) {
    igst = sepRound(taxable * cfg.gstRate / 100);
  } else {
    cgst = sepRound(taxable * cfg.gstRate / 200);
    sgst = sepRound(taxable * cfg.gstRate / 200);
  }
  const total = taxable + cgst + sgst + igst;
  el.innerHTML = `<div class="flex-between"><span class="card-label">Taxable</span><span class="card-title ff-mono">${formatCurrency(taxable)}</span></div>
    ${isInter ? `<div class="flex-between mt-4"><span class="card-label">IGST @${cfg.gstRate}%</span><span class="card-title ff-mono">${formatCurrency(igst)}</span></div>` : `<div class="flex-between mt-4"><span class="card-label">CGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(cgst)}</span></div>
         <div class="flex-between mt-4"><span class="card-label">SGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(sgst)}</span></div>`}
    <div class="flex-between mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
      <span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(total)}</span>
    </div>
    <div class="card-meta mt-4">${isInter ? "Inter" : "Intra"}-state supply</div>`;
}
function submitInvoiceForm() {
  const clientId = document.getElementById("invFormClient").value;
  if (!clientId) {
    alert("Please select a client.");
    return;
  }
  const invDate = document.getElementById("invFormDate").value;
  if (!invDate) {
    alert("Please select a date.");
    return;
  }
  const client = getClients().find((c) => c.id === clientId);
  const cfg = getInvCfg();
  const isInter = client.stateCode !== cfg.stateCode;
  const lineItems = [];
  document.querySelectorAll(".inv-line-item").forEach((line) => {
    const desc = line.querySelector(".inv-desc").value.trim();
    const qty = parseFloat(line.querySelector(".inv-qty").value) || 0;
    const rate = parseFloat(line.querySelector(".inv-rate").value) || 0;
    const unit = line.querySelector(".inv-unit").value;
    if (desc && qty > 0 && rate > 0) {
      lineItems.push({ desc, unit, rate, qty, amount: sepRound(qty * rate) });
    }
  });
  if (lineItems.length === 0) {
    alert("Add at least one valid line item.");
    return;
  }
  const taxableValue = lineItems.reduce((s, li) => s + li.amount, 0);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (isInter) {
    igst = sepRound(taxableValue * cfg.gstRate / 100);
  } else {
    cgst = sepRound(taxableValue * cfg.gstRate / 200);
    sgst = sepRound(taxableValue * cfg.gstRate / 200);
  }
  const total = taxableValue + cgst + sgst + igst;
  const state = getState();
  const origToday = state.today;
  state.today = invDate;
  const invNo = genInvNumber();
  state.today = origToday;
  const existingInv = getInvoices().find((i) => i.invNo === invNo);
  if (existingInv && !confirm(`\u26A0 Invoice ${invNo} already exists (${existingInv.clientName || "?"}, ${existingInv.date}, total ${formatCurrency(existingInv.total || 0)}).

Save anyway with the same number?`)) return;
  if (!confirm(`Create invoice ${invNo} for ${client.name}?

Items: ${lineItems.length}
Taxable: ${formatCurrency(taxableValue)}
Total: ${formatCurrency(total)}`)) return;
  const inv = {
    id: "inv_" + Date.now().toString(36),
    invNo,
    date: invDate,
    clientId: client.id,
    clientName: client.name,
    clientGstin: client.gstin,
    sac: cfg.sac,
    lineItems,
    taxableValue,
    cgst,
    sgst,
    igst,
    total,
    supplyType: isInter ? "inter" : "intra",
    payStatus: "unpaid",
    payDate: null,
    payAmount: 0,
    createdAt: tnow()
  };
  const invoices = getInvoices();
  invoices.push(inv);
  saveJSON(K.invoices, invoices);
  cfg.nextNumber = (cfg.nextNumber || 1) + 1;
  saveJSON(K.invCfg, cfg);
  closeInvModal();
  if (typeof window.renderInvoice === "function") window.renderInvoice();
}

// src/components/invoice-detail.js
function viewInvoice(invId) {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invId);
  if (!inv) return;
  history.pushState({ popup: "invoice" }, "");
  const client = getClients().find((c) => c.id === inv.clientId);
  const cfg = getInvCfg();
  const linesHtml = inv.lineItems.map((li) => `<div class="worker-row">
      <div class="worker-info">
        <div class="worker-name">${esc(li.desc)}</div>
        <div class="worker-detail">${li.qty} ${li.unit} \xD7 \u20B9${li.rate}/${li.unit}</div>
      </div>
      <div class="text-right"><div class="card-title ff-mono">${formatCurrency(li.amount)}</div></div>
    </div>`).join("");
  const payClass = inv.payStatus === "paid" ? "badge-attend" : inv.payStatus === "partial" ? "badge-warning" : "badge-absent";
  const payLabel = inv.payStatus === "paid" ? "Paid" : inv.payStatus === "partial" ? "Partial" : "Unpaid";
  const html = `<div class="settings-overlay" ${overlayClose("closeInvDetail")}>
    <div class="settings-panel">
      <div class="flex-between" style="padding:var(--sp-12) var(--sp-16);border-bottom:1px solid var(--border)">
        <span class="card-title">Invoice Detail</span>
        <button class="header-btn" ${da("closeInvDetail")}>\u2715</button>
      </div>
      <div class="settings-body">
        <div class="section-zone">
          <div class="card-hero">
            <div class="card-label">${esc(cfg.companyName)}</div>
            <div class="card-value-xl text-cost mt-4">${esc(inv.invNo)}</div>
            <div class="card-meta mt-8">${formatDate(inv.date)}</div>
          </div>
        </div>
        <div class="section-zone">
          <div class="section-label">Bill To</div>
          <div class="card-base">
            <div class="card-title">${esc(client?.name || inv.clientName)}</div>
            <div class="card-meta mt-4">GSTIN: ${esc(inv.clientGstin || "\u2014")}</div>
            <div class="card-meta">SAC: ${esc(inv.sac)} | ${inv.supplyType === "inter" ? "Inter-state" : "Intra-state"}</div>
          </div>
        </div>
        <div class="section-zone">
          <div class="section-label">Line Items</div>
          <div class="card-action">${linesHtml}</div>
        </div>
        <div class="section-zone">
          <div class="section-label">Tax Summary</div>
          <div class="card-base">
            <div class="flex-between"><span class="card-label">Taxable Value</span><span class="card-title ff-mono">${formatCurrency(inv.taxableValue)}</span></div>
            ${inv.cgst ? `<div class="flex-between mt-4"><span class="card-label">CGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(inv.cgst)}</span></div>` : ""}
            ${inv.sgst ? `<div class="flex-between mt-4"><span class="card-label">SGST @${cfg.gstRate / 2}%</span><span class="card-title ff-mono">${formatCurrency(inv.sgst)}</span></div>` : ""}
            ${inv.igst ? `<div class="flex-between mt-4"><span class="card-label">IGST @${cfg.gstRate}%</span><span class="card-title ff-mono">${formatCurrency(inv.igst)}</span></div>` : ""}
            <div class="flex-between mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
              <span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(inv.total)}</span>
            </div>
          </div>
        </div>
        <div class="section-zone">
          <div class="flex-between">
            <span class="badge ${payClass}">${payLabel}</span>
            ${inv.payStatus !== "paid" ? `<div class="flex-center gap-4">
              <button class="btn btn-secondary btn-sm" ${da("markInvPartial", inv.id)}>Partial</button>
              <button class="btn btn-attend btn-sm" ${da("markInvPaid", inv.id)}>Mark Paid</button>
            </div>` : `<span class="card-meta">Paid on ${inv.payDate || "\u2014"}</span>`}
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
function closeInvDetail() {
  const el = document.querySelector(".settings-overlay");
  if (el) el.remove();
}
function markInvPaid(invId) {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invId);
  if (!inv) return;
  inv.payStatus = "paid";
  inv.payDate = formatDateShort(getState().today);
  inv.payAmount = inv.total;
  saveJSON(K.invoices, invoices);
  closeInvDetail();
  if (typeof window.renderInvoice === "function") window.renderInvoice();
}
function markInvPartial(invId) {
  const invoices = getInvoices();
  const inv = invoices.find((i) => i.id === invId);
  if (!inv) return;
  const amt = prompt(`Amount received (of ${formatCurrency(inv.total)}):`);
  if (!amt) return;
  const amount = parseInt(amt);
  if (isNaN(amount) || amount <= 0) return;
  inv.payStatus = amount >= inv.total ? "paid" : "partial";
  inv.payDate = formatDateShort(getState().today);
  inv.payAmount = amount;
  saveJSON(K.invoices, invoices);
  closeInvDetail();
  if (typeof window.renderInvoice === "function") window.renderInvoice();
}

// src/shared/storage/stock.js
function getStock() {
  return loadJSON(K.stock, DEF_STOCK);
}
function getStockLog() {
  return loadJSON(K.stockLog, []);
}

// src/components/alerts.js
function getCWPayDueAlerts() {
  const alerts = [];
  const today = getState().today;
  const d = /* @__PURE__ */ new Date(today + "T00:00:00");
  const dow = d.getDay();
  const satDate = getWeekEnd(today);
  const paid = loadJSON(K.cwPay, {});
  const isPaid = paid[satDate]?.paid || false;
  if (!isPaid) {
    if (dow === 4 || dow === 5) {
      alerts.push(`<div class="alert-banner alert-warning">\u{1F4B0} CW pay due Saturday (${formatDateShort(satDate)})</div>`);
    } else if (dow === 6) {
      alerts.push(`<div class="alert-banner alert-danger">\u26A0 CW pay overdue \u2014 not yet marked paid for week ending ${formatDateShort(satDate)}</div>`);
    }
  }
  return alerts;
}
function getAttendancePatternAlerts() {
  const alerts = [];
  const allWorkers = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const today = /* @__PURE__ */ new Date(getState().today + "T00:00:00");
  const permIds = new Set(getPermWorkers().map((p) => p.id));
  allWorkers.forEach((w) => {
    const isPerm = permIds.has(w.id);
    const store = isPerm ? peAtt : cwAtt;
    const type = isPerm ? "perm" : "cw";
    let absentLast7 = 0;
    let consecutiveAbsent = 0;
    let maxConsecutive = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = localDateStr(d);
      const k = getAttKey(type, w.id, ds);
      const rec = store[k];
      const isAbsent = !rec || rec.status === "A";
      if (isAbsent) {
        absentLast7++;
        consecutiveAbsent++;
        if (consecutiveAbsent > maxConsecutive) maxConsecutive = consecutiveAbsent;
      } else {
        consecutiveAbsent = 0;
      }
    }
    if (maxConsecutive >= 3) {
      alerts.push(`<div class="alert-banner alert-danger">\u{1F6A8} ${esc(w.name)} absent ${maxConsecutive} consecutive days</div>`);
    } else if (absentLast7 >= 3) {
      alerts.push(`<div class="alert-banner alert-warning">\u26A0 ${esc(w.name)} absent ${absentLast7} of last 7 days</div>`);
    }
  });
  return alerts;
}

// src/dashboard/tabs/home.js
function renderHome() {
  const date = getState().today;
  const allW = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  let permP = 0;
  let cwP = 0;
  getActivePermProd().forEach((w) => {
    const k = getAttKey("perm", w.id, date);
    if (peAtt[k] && (peAtt[k].status === "P" || peAtt[k].status === "OT")) permP++;
  });
  getActiveCW().forEach((w) => {
    const k = getAttKey("cw", w.id, date);
    if (cwAtt[k] && (cwAtt[k].status === "P" || cwAtt[k].status === "OT")) cwP++;
  });
  const totalP = permP + cwP;
  const prod = getProdDay(date);
  const totalPieces = prod?.totals?.pieces || 0;
  const areasActive = prod ? Object.values(prod.periods?.standard?.areas || {}).filter((a) => a.cap > 0).length : 0;
  const wageCost = calcDayWages({
    date,
    cfg: getCfg(),
    cwAtt,
    peAtt,
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards()
  });
  document.getElementById("homePresent").textContent = totalP;
  document.getElementById("homePresentDetail").textContent = `of ${allW.length} workers present`;
  document.getElementById("homeProd").textContent = totalPieces || "\u2014";
  document.getElementById("homePerm").textContent = permP;
  document.getElementById("homeCW").textContent = cwP;
  document.getElementById("homeCost").textContent = formatCurrency(wageCost);
  document.getElementById("homeAreas").textContent = areasActive;
  renderHomeAlerts(date, totalP, allW.length);
}
function renderHomeAlerts(date, present, total) {
  const el = document.getElementById("homeAlerts");
  const alerts = [];
  if (present > 0 && present < total * 0.7) {
    alerts.push(`<div class="alert-banner alert-warning">\u26A0 Low attendance: ${present}/${total} workers present</div>`);
  }
  alerts.push(...getCWPayDueAlerts());
  alerts.push(...getAttendancePatternAlerts());
  const stock = getStock();
  const lowStock = stock.filter((s) => s.qty > 0 && s.qty <= s.threshold);
  if (lowStock.length) {
    alerts.push(`<div class="alert-banner alert-danger">\u{1F4E6} Low stock: ${lowStock.map((s) => s.name).join(", ")}</div>`);
  }
  const month = monthOf(date);
  if (isMonthLocked(month)) {
    alerts.push(`<div class="alert-banner alert-info">\u{1F512} ${month} is locked \u2014 records are read-only</div>`);
  }
  if (isSunday(date)) {
    alerts.push(`<div class="alert-banner alert-info">\u{1F4C5} Sunday \u2014 Holiday shift pattern active</div>`);
  }
  if (alerts.length === 0) {
    el.innerHTML = `<div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">\u2713</div>
      <div class="empty-state-text">All clear</div>
      <div class="empty-state-sub">No alerts for today</div>
    </div></div>`;
  } else {
    el.innerHTML = alerts.join("");
  }
}

// src/dashboard/tabs/attendance.js
function renderAttendance() {
  const date = getState().today;
  const monthLocked = isMonthLocked(monthOf(date));
  const perm = getActivePermProd();
  const cw = getActiveCW();
  const guard = getPermWorkers().filter((w) => DEF_CFG.guardIds.includes(w.id) && !w.inactive);
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const list = document.getElementById("workerList");
  const filter = getState().attFilter;
  const workers = [];
  if (filter === "all" || filter === "perm") {
    workers.push(...perm.map((w) => ({ ...w, type: "perm" })));
    workers.push(...guard.map((w) => ({ ...w, type: "perm" })));
  }
  if (filter === "all" || filter === "cw") {
    workers.push(...cw.map((w) => ({ ...w, type: "cw" })));
  }
  if (workers.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">\u{1F477}</div>
      <div class="empty-state-text">No workers to show</div>
      <div class="empty-state-sub">Check filter or add workers in Settings</div>
    </div>`;
  } else {
    list.innerHTML = workers.map((w) => {
      const attStore = w.type === "perm" ? peAtt : cwAtt;
      const k = getAttKey(w.type, w.id, date);
      const rec = attStore[k];
      const status = rec?.status || "";
      const otHours = rec?.otHours || 0;
      const typeCls = w.type === "perm" ? "badge-perm" : "badge-cw";
      const typeLabel = w.type === "perm" ? "P" : "C";
      const otBadge = otHours > 0 ? `<span class="badge badge-warning">OT ${otHours}h</span>` : "";
      const statusBadge = monthLocked ? `<span class="badge ${status === "A" ? "badge-danger" : status ? "badge-attend" : "badge-perm"}" data-attendance-locked-status>${status === "A" ? "Absent" : status ? "Present" : "\u2014"}</span>` : `<button class="mark-btn present ${status === "P" || status === "OT" ? "active" : ""}"
                  ${da("markAtt", w.id, w.type, "P")}>\u2713</button>
          <button class="mark-btn absent ${status === "A" ? "active" : ""}"
                  ${da("markAtt", w.id, w.type, "A")}>\u2717</button>`;
      return `<div class="worker-row">
        <div class="worker-avatar">${esc(w.name).charAt(0)}</div>
        <div class="worker-info">
          <div class="worker-name">${esc(w.name)} <span class="badge ${typeCls}">${typeLabel}</span> ${otBadge}</div>
          <div class="worker-detail">${esc(w.role || "Contract Worker")}</div>
        </div>
        <div class="worker-status">${statusBadge}</div>
      </div>`;
    }).join("");
  }
  if (monthLocked) {
    list.insertAdjacentHTML(
      "afterbegin",
      `<div class="alert-banner alert-info" data-attendance-locked-banner>\u{1F512} ${monthOf(date)} is locked \u2014 attendance is read-only.</div>`
    );
  }
  let permP = 0;
  let cwP = 0;
  perm.forEach((w) => {
    const k = getAttKey("perm", w.id, date);
    if (peAtt[k] && (peAtt[k].status === "P" || peAtt[k].status === "OT")) permP++;
  });
  guard.forEach((w) => {
    const k = getAttKey("perm", w.id, date);
    if (peAtt[k] && (peAtt[k].status === "P" || peAtt[k].status === "OT")) permP++;
  });
  cw.forEach((w) => {
    const k = getAttKey("cw", w.id, date);
    if (cwAtt[k] && (cwAtt[k].status === "P" || cwAtt[k].status === "OT")) cwP++;
  });
  document.getElementById("attPresent").textContent = permP + cwP;
  document.getElementById("attPermBadge").textContent = `Perm: ${permP}`;
  document.getElementById("attCWBadge").textContent = `CW: ${cwP}`;
}
function markAtt(workerId, type, status) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "attendance changes")) return;
  const storeKey = type === "perm" ? K.peAtt : K.cwAtt;
  const att = loadJSON(storeKey, {});
  const k = getAttKey(type, workerId, date);
  if (att[k] && att[k].status === status) {
    delete att[k];
  } else {
    att[k] = { status, time: tnow(), otHours: 0 };
  }
  saveJSON(storeKey, att);
  renderAttendance();
  if (getState().currentTab === "home") renderHome();
}
function initAttendanceFilter() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn || !btn.closest("#tab-attendance")) return;
    setState({ attFilter: btn.dataset.filter });
    btn.closest(".flex-center").querySelectorAll(".nb").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderAttendance();
  });
}

// src/dashboard/tabs/production.js
function renderProduction() {
  const date = getState().today;
  const monthLocked = isMonthLocked(monthOf(date));
  let prod = getProdDay(date);
  if (!prod) {
    prod = initProdDay();
    saveProdDay(date, prod);
  }
  const areas = getAreas();
  const cfg = getCfg();
  document.getElementById("tab-production").setAttribute("data-month-locked", monthLocked ? "true" : "false");
  document.getElementById("prodTotal").textContent = prod.totals?.pieces || "\u2014";
  const extraTotal = (prod.totals?.extraCost || 0) + (prod.totals?.snackCost || 0);
  document.getElementById("prodExtraCost").textContent = formatCurrency(extraTotal);
  const shortfall = prod.totals?.extraHours || 0;
  document.getElementById("prodExtraDetail").textContent = shortfall > 0 ? `${shortfall}h shortfall + ${prod.totals?.snackCost ? "snack" : "no snack"}` : "no shortfall";
  renderShiftBanner(date);
  renderProdAttendance(date, prod);
  renderProdPeriods(date, prod, areas, cfg);
  const confirmEl = document.getElementById("prodConfirmSection");
  confirmEl.style.display = !monthLocked && prod.attLocked && !prod.confirmed ? "block" : "none";
  const lockBadge = document.getElementById("prodLockBadge");
  if (prod.confirmed) {
    lockBadge.textContent = "Confirmed";
    lockBadge.className = "badge badge-attend";
  } else if (prod.attLocked) {
    lockBadge.textContent = "Locked";
    lockBadge.className = "badge badge-warning";
  } else {
    lockBadge.textContent = "Unlocked";
    lockBadge.className = "badge badge-neutral";
  }
  renderProdLog(date, prod);
}
function renderProdAttendance(date, prod) {
  const el = document.getElementById("prodAttSection");
  const monthLocked = isMonthLocked(monthOf(date));
  const allW = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  if (prod.attLocked) {
    const present = prod.present || [];
    const perm = present.filter((id) => findWorker(id).type === "perm");
    const cw = present.filter((id) => findWorker(id).type === "cw");
    el.innerHTML = `
      <div class="flex-between">
        <div>
          <div class="card-value text-attend">${present.length}</div>
          <div class="card-label">workers locked in</div>
        </div>
        <div class="flex-center gap-4">
          <span class="badge badge-perm">P: ${perm.length}</span>
          <span class="badge badge-cw">C: ${cw.length}</span>
        </div>
      </div>
      ${!prod.confirmed && !monthLocked ? `<button class="btn btn-secondary btn-sm mt-12" ${da("unlockProdAtt")}>Unlock to Edit</button>` : ""}
    `;
    return;
  }
  if (monthLocked) {
    el.innerHTML = `<div class="alert-banner alert-info" data-prod-locked-banner>\u{1F512} ${monthOf(date)} is locked \u2014 production controls are disabled.</div>`;
    return;
  }
  let html = '<div class="period-area-card">';
  const presentIds = [];
  allW.forEach((w) => {
    const attStore = w.type === "perm" ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    if (attStore[k] && attStore[k].status !== "A") presentIds.push(w.id);
  });
  html += allW.map((w) => {
    const isPresent = presentIds.includes(w.id);
    const typeCls = w.type === "perm" ? "badge-perm" : "badge-cw";
    return `<div class="worker-row">
      <div class="worker-avatar">${esc(w.name).charAt(0)}</div>
      <div class="worker-info">
        <div class="worker-name">${esc(w.name)} <span class="badge ${typeCls}">${w.type === "perm" ? "P" : "C"}</span></div>
      </div>
      <div class="worker-status">
        <button class="mark-btn present ${isPresent ? "active" : ""}" ${da("markAttFromProduction", w.id, w.type, "P")}>\u2713</button>
        <button class="mark-btn absent ${!isPresent && presentIds.length > 0 ? "active" : ""}" ${da("markAttFromProduction", w.id, w.type, "A")}>\u2717</button>
      </div>
    </div>`;
  }).join("");
  html += `</div>
    <button class="btn btn-primary btn-full mt-8" ${da("lockProdAtt")}>Lock Attendance (${presentIds.length} present)</button>`;
  el.innerHTML = html;
}
function lockProdAtt() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "production lock")) return;
  let prod = getProdDay(date) || initProdDay();
  const allW = getAllProdWorkers();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const present = [];
  allW.forEach((w) => {
    const attStore = w.type === "perm" ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    if (attStore[k] && attStore[k].status !== "A") present.push(w.id);
  });
  if (present.length === 0) {
    alert("Mark at least one worker present.");
    return;
  }
  prod.attLocked = true;
  prod.present = present;
  prod.lockedAt = tnow();
  autoAssignRosters(prod, "standard", present);
  prod.timeline = prod.timeline || [];
  prod.timeline.push({ time: tnow(), type: "system", text: `Attendance locked: ${present.length} workers` });
  recalcExtra(prod, getAreas(), getCfg());
  saveProdDay(date, prod);
  renderProduction();
}
function unlockProdAtt() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "production unlock")) return;
  const prod = getProdDay(date);
  if (!prod) return;
  prod.attLocked = false;
  prod.confirmed = false;
  prod.timeline.push({ time: tnow(), type: "system", text: "Attendance unlocked for editing" });
  saveProdDay(date, prod);
  renderProduction();
}
function autoAssignRosters(prod, periodKey, present) {
  const areas = getAreas();
  const period = prod.periods[periodKey];
  if (!period.areas) period.areas = {};
  areas.forEach((area) => {
    if (!period.areas[area.id]) {
      period.areas[area.id] = {
        cap: periodKey === "standard" ? area.dep ? 0 : area.caps[area.caps.length - 1]?.l || 0 : 0,
        assigned: []
      };
    }
    const pa = period.areas[area.id];
    if (pa.cap === 0 && !area.dep) return;
    const rosterPresent = area.roster.filter((id) => present.includes(id));
    pa.assigned = rosterPresent;
  });
  autoPickling(prod, periodKey);
}
function autoPickling(prod, periodKey) {
  const areas = getAreas();
  const period = prod.periods[periodKey];
  areas.filter((a) => a.dep).forEach((pa) => {
    if (!period.areas[pa.id]) period.areas[pa.id] = { cap: 0, assigned: [] };
    const depCaps = pa.depOn.map((did) => period.areas[did]?.cap || 0);
    if (depCaps.every((c) => c === 0)) {
      period.areas[pa.id].cap = 0;
      period.areas[pa.id].assigned = [];
    } else {
      const present = prod.present || [];
      period.areas[pa.id].cap = 1;
      period.areas[pa.id].assigned = pa.roster.filter((id) => present.includes(id));
    }
  });
}
function renderProdPeriods(date, prod, areas, cfg) {
  const container = document.getElementById("prodPeriodsContainer");
  if (!prod.attLocked) {
    container.innerHTML = '<div class="card-info section-zone"><div class="empty-state"><div class="empty-state-text">Lock attendance to configure production</div></div></div>';
    return;
  }
  const periods = [
    { key: "morningOT", label: "Morning OT", time: `${cfg.morningOT.start}\u2013${cfg.morningOT.end}`, hours: cfg.morningOT.hours, isOT: true },
    { key: "standard", label: "Standard Shift", time: `${cfg.standardShift.start}\u2013${cfg.standardShift.end}`, hours: cfg.standardShift.hours, isOT: false },
    { key: "eveningOT", label: "Evening OT", time: `${cfg.eveningOT.start}\u2013${cfg.eveningOT.end}`, hours: cfg.eveningOT.hours, isOT: true }
  ];
  const isHolidayShift = isShiftSunday(date);
  container.innerHTML = periods.map((p) => {
    const period = prod.periods[p.key];
    const isActive = p.key === "standard" || period?.active;
    if (!isActive && p.isOT) {
      if (isHolidayShift) {
        return `<div class="period-card">
          <div class="card-info" style="padding:var(--sp-10) var(--sp-12)">
            <div class="flex-between">
              <div>
                <span class="card-label">${p.label}</span>
                <span class="card-meta"> ${p.time}</span>
              </div>
              <button class="btn btn-sm" style="color:var(--text-muted);font-size:var(--fs-2xs)" ${da("togglePeriod", p.key, true)}>Add OT anyway</button>
            </div>
          </div>
        </div>`;
      }
      return `<div class="period-card">
        <div class="card-info" style="padding:var(--sp-10) var(--sp-12)">
          <div class="flex-between">
            <div>
              <span class="card-label">${p.label}</span>
              <span class="card-meta"> ${p.time}</span>
            </div>
            <button class="btn btn-secondary btn-sm" ${da("togglePeriod", p.key, true)}>+ Enable</button>
          </div>
        </div>
      </div>`;
    }
    let areaHtml = "";
    areas.filter((a) => !a.dep).forEach((area) => {
      const pa = period?.areas?.[area.id] || { cap: 0, assigned: [] };
      const cap = pa.cap;
      const assigned = pa.assigned || [];
      const req = getReq(area.id, p.key, prod, areas);
      const statusColor = cap === 0 ? "text-muted" : assigned.length >= req ? "text-attend" : "text-danger";
      const capBtns = area.caps.map(
        (c) => `<button class="nb ${cap === c.l ? "active" : ""}" ${da("setProdCap2", p.key, area.id, c.l)}>${c.lb}</button>`
      ).join("");
      const workerChips = assigned.map((wid) => {
        const w = findWorker(wid);
        const cls = w.type === "perm" ? "badge-perm" : "badge-cw";
        return `<span class="badge ${cls}">${esc(w.name)}</span>`;
      }).join(" ");
      areaHtml += `<div class="card-base period-area-card">
        <div class="flex-between">
          <div class="card-title">${esc(area.name)}</div>
          <span class="${statusColor} area-count ff-mono">${assigned.length}/${req}</span>
        </div>
        <div class="mt-8 chip-row">${capBtns}</div>
        <div class="mt-8 chip-row">${workerChips || '<span class="card-meta">No workers assigned</span>'}</div>
        ${cap > 0 && !prod.confirmed ? `<button class="btn btn-secondary btn-sm mt-8" ${da("openPicker", p.key, area.id)}>Edit Workers</button>` : ""}
      </div>`;
    });
    areas.filter((a) => a.dep).forEach((area) => {
      const pa = period?.areas?.[area.id] || { cap: 0, assigned: [] };
      const req = getReq(area.id, p.key, prod, areas);
      if (req === 0) return;
      const assigned = pa.assigned || [];
      const statusColor = assigned.length >= req ? "text-attend" : "text-danger";
      const workerChips = assigned.map((wid) => {
        const w = findWorker(wid);
        return `<span class="badge ${w.type === "perm" ? "badge-perm" : "badge-cw"}">${esc(w.name)}</span>`;
      }).join(" ");
      areaHtml += `<div class="card-daily period-area-card">
        <div class="flex-between">
          <div class="card-label">${esc(area.name)}</div>
          <span class="${statusColor} area-count-sm ff-mono">${assigned.length}/${req}</span>
        </div>
        <div class="mt-4 chip-row">${workerChips || '<span class="card-meta">Auto-assigned</span>'}</div>
        ${!prod.confirmed ? `<button class="btn btn-secondary btn-sm mt-4" ${da("openPicker", p.key, area.id)}>Edit</button>` : ""}
      </div>`;
    });
    return `<div class="period-card">
      <div class="section-zone">
        <div class="flex-between mb-10">
          <div>
            <span class="section-label-md" style="margin-bottom:0;display:inline">${p.label}</span>
            <span class="card-meta"> ${p.time} (${p.hours}h)</span>
          </div>
          ${p.isOT ? `<button class="btn btn-sm" style="color:var(--danger)" ${da("togglePeriod", p.key, false)}>Disable</button>` : ""}
        </div>
        ${areaHtml}
      </div>
    </div>`;
  }).join("");
}
function togglePeriod(periodKey, enable) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "period toggle")) return;
  let prod = getProdDay(date) || initProdDay();
  prod.periods[periodKey].active = enable;
  if (enable) {
    prod.periods[periodKey].expanded = true;
    if (prod.present) autoAssignRosters(prod, periodKey, prod.present);
    prod.timeline.push({ time: tnow(), type: "system", text: `${periodKey === "morningOT" ? "Morning" : "Evening"} OT enabled` });
  } else {
    prod.periods[periodKey].expanded = false;
    prod.timeline.push({ time: tnow(), type: "system", text: `${periodKey === "morningOT" ? "Morning" : "Evening"} OT disabled` });
  }
  recalcExtra(prod, getAreas(), getCfg());
  saveProdDay(date, prod);
  renderProduction();
}
function setProdCap2(periodKey, areaId, level) {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "capacity change")) return;
  let prod = getProdDay(date) || initProdDay();
  const period = prod.periods[periodKey];
  if (!period.areas) period.areas = {};
  if (!period.areas[areaId]) period.areas[areaId] = { cap: 0, assigned: [] };
  period.areas[areaId].cap = Number(level);
  autoPickling(prod, periodKey);
  recalcExtra(prod, getAreas(), getCfg());
  saveProdDay(date, prod);
  renderProduction();
}
function showProdConfirm() {
  const date = getState().today;
  const prod = getProdDay(date);
  const present = prod.present || [];
  const perm = present.filter((id) => findWorker(id).type === "perm");
  const cw = present.filter((id) => findWorker(id).type === "cw");
  const extraCost = (prod.totals?.extraCost || 0) + (prod.totals?.snackCost || 0);
  const otMap = {};
  ["morningOT", "eveningOT"].forEach((pk) => {
    const period = prod.periods[pk];
    if (!period?.active) return;
    const hours = period.hours || 3;
    const workerSet = /* @__PURE__ */ new Set();
    Object.values(period.areas || {}).forEach((pa) => (pa.assigned || []).forEach((id) => workerSet.add(id)));
    workerSet.forEach((id) => {
      otMap[id] = (otMap[id] || 0) + hours;
    });
  });
  const html = `<div class="confirm-overlay" ${overlayClose("cancelConfirm")}>
    <div class="confirm-dialog">
      <div class="confirm-icon">\u2713</div>
      <div class="confirm-title">Confirm ${present.length} Workers?</div>
      <div class="confirm-desc">Attendance + OT will be written to records. Extra cost: ${formatCurrency(extraCost)}</div>
      <div class="confirm-breakdown">
        <span class="badge badge-perm">${perm.length} Perm \u2192 peAtt</span>
        <span class="badge badge-cw">${cw.length} CW \u2192 cwAtt</span>
      </div>
      ${Object.keys(otMap).length > 0 ? `<div class="card-meta mb-12">OT: ${Object.entries(otMap).map(([id, h]) => `${findWorker(id).name} ${h}h`).join(", ")}</div>` : ""}
      <div class="confirm-btns">
        <button class="btn btn-secondary" ${da("cancelConfirm")}>Cancel</button>
        <button class="btn btn-attend" ${da("confirmProduction")}>Confirm</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
function cancelConfirm() {
  const el = document.querySelector(".confirm-overlay");
  if (el) el.remove();
}
function confirmProduction() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "production confirm")) return;
  const prod = getProdDay(date);
  if (!prod || !prod.present || prod.present.length === 0) {
    if (!confirm("\u26A0 No workers are marked present for this date.\n\nConfirm production anyway?")) return;
  }
  const cfg = getCfg();
  const otMap = {};
  ["morningOT", "eveningOT"].forEach((pk) => {
    const period = prod.periods[pk];
    if (!period?.active) return;
    const hours = period.hours || 3;
    Object.values(period.areas || {}).forEach(
      (pa) => (pa.assigned || []).forEach((id) => {
        otMap[id] = (otMap[id] || 0) + hours;
      })
    );
  });
  const present = prod.present || [];
  present.forEach((id) => {
    const w = findWorker(id);
    const storeKey = w.type === "perm" ? K.peAtt : K.cwAtt;
    const att = loadJSON(storeKey, {});
    const k = getAttKey(w.type, id, date);
    att[k] = {
      status: otMap[id] ? "OT" : "P",
      otHours: otMap[id] || 0,
      time: prod.lockedAt || tnow()
    };
    saveJSON(storeKey, att);
  });
  if (prod.periods.eveningOT?.active) {
    const snackLog = loadJSON(K.permSnack, []);
    const evWorkers = /* @__PURE__ */ new Set();
    Object.values(prod.periods.eveningOT.areas || {}).forEach(
      (pa) => (pa.assigned || []).forEach((id) => evWorkers.add(id))
    );
    prod.periods.eveningOT.workers = [...evWorkers];
    evWorkers.forEach((id) => {
      const w = findWorker(id);
      if (w.type === "perm") {
        snackLog.push({
          empId: id,
          date,
          otHours: prod.periods.eveningOT.hours,
          snack: cfg.snackRate,
          week: getWeekEnd(date)
        });
      }
    });
    saveJSON(K.permSnack, snackLog);
  }
  prod.confirmed = true;
  prod.confirmedAt = tnow();
  recalcExtra(prod, getAreas(), getCfg());
  prod.timeline.push({
    time: tnow(),
    type: "confirm",
    text: `Production confirmed: ${present.length} workers, OT for ${Object.keys(otMap).length}`
  });
  saveProdDay(date, prod);
  cancelConfirm();
  renderProduction();
  if (getState().currentTab === "home") renderHome();
}
function renderProdLog(date, prod) {
  const el = document.getElementById("prodLog");
  if (!prod || !prod.timeline || prod.timeline.length === 0) {
    el.innerHTML = `<div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">\u{1F4CB}</div>
      <div class="empty-state-text">No entries yet</div>
      <div class="empty-state-sub">Production entries appear as you work</div>
    </div></div>`;
    return;
  }
  el.innerHTML = prod.timeline.map((entry) => `<div class="card-daily">
      <div class="flex-between">
        <span class="card-label">${entry.time || ""}</span>
        <span class="card-meta">${entry.type || "note"}</span>
      </div>
      <div class="card-title mt-4">${esc(entry.text || "")}</div>
    </div>`).join("");
}
function logProdEntry() {
  const pieces = parseInt(document.getElementById("prodPiecesInput")?.value) || 0;
  const weight = parseFloat(document.getElementById("prodWeightInput")?.value) || 0;
  if (pieces === 0 && weight === 0) return;
  const date = getState().today;
  let prod = getProdDay(date) || initProdDay();
  prod.totals = prod.totals || { pieces: 0, weight: 0 };
  prod.totals.pieces = (prod.totals.pieces || 0) + pieces;
  prod.totals.weight = Math.round(((prod.totals.weight || 0) + weight) * 10) / 10;
  prod.timeline = prod.timeline || [];
  const parts = [];
  if (pieces) parts.push(`${pieces} pcs`);
  if (weight) parts.push(`${weight} kg`);
  prod.timeline.push({
    time: tnow(),
    type: "production",
    text: `Logged: ${parts.join(" / ")} \u2192 Total: ${prod.totals.pieces} pcs / ${prod.totals.weight} kg`
  });
  saveProdDay(date, prod);
  const pInput = document.getElementById("prodPiecesInput");
  const wInput = document.getElementById("prodWeightInput");
  if (pInput) pInput.value = "";
  if (wInput) wInput.value = "";
  renderProduction();
}
function isShiftSunday(date) {
  return isSunday(date) || (getProdDay(date)?.isHoliday || false);
}
function toggleHoliday() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "holiday toggle")) return;
  let prod = getProdDay(date) || initProdDay();
  prod.isHoliday = !prod.isHoliday;
  prod.timeline = prod.timeline || [];
  prod.timeline.push({
    time: tnow(),
    type: "system",
    text: prod.isHoliday ? "Marked as Holiday shift" : "Holiday shift removed"
  });
  saveProdDay(date, prod);
  renderProduction();
}
function renderShiftBanner(date) {
  const el = document.getElementById("prodShiftBanner");
  if (!el) return;
  const cfg = getCfg();
  const sunday = isSunday(date);
  const prod = getProdDay(date);
  const holiday = prod?.isHoliday || false;
  const isSpecial = sunday || holiday;
  if (!isSpecial) {
    el.innerHTML = "";
    return;
  }
  const shift = cfg.sundayHolidayShift;
  el.innerHTML = `<div class="alert-banner alert-info mb-12">
    \u{1F4C5} ${sunday ? "Sunday" : "Holiday"} shift: ${shift.start}\u2013${shift.end} (${shift.hours}h, no lunch)
    ${!sunday ? `<button class="btn btn-sm" style="margin-left:auto;color:var(--danger)" ${da("toggleHoliday")}>Remove</button>` : ""}
  </div>`;
}
function markAllPresent() {
  const date = getState().today;
  if (requireUnlocked(monthOf(date), "mark-all-present")) return;
  const allW = getAllProdWorkers();
  const guard = getGuards();
  allW.forEach((w) => {
    const storeKey = w.type === "perm" ? K.peAtt : K.cwAtt;
    const att = loadJSON(storeKey, {});
    const k = getAttKey(w.type, w.id, date);
    if (!att[k] || att[k].status === "A") {
      att[k] = { status: "P", time: tnow(), otHours: 0 };
      saveJSON(storeKey, att);
    }
  });
  guard.forEach((w) => {
    const att = loadJSON(K.peAtt, {});
    const k = getAttKey("perm", w.id, date);
    if (!att[k]) {
      att[k] = { status: "P", time: tnow(), otHours: 0 };
      saveJSON(K.peAtt, att);
    }
  });
  if (typeof window.renderTab === "function") {
    window.renderTab(getState().currentTab);
  }
}
function markAttFromProduction(workerId, type, status) {
  markAtt(workerId, type, status);
  renderProduction();
}
function addProdNote() {
  const note = prompt("Add production note:");
  if (!note || !note.trim()) return;
  const date = getState().today;
  let prod = getProdDay(date) || initProdDay();
  prod.timeline = prod.timeline || [];
  prod.timeline.push({ time: tnow(), type: "note", text: note.trim() });
  saveProdDay(date, prod);
  if (getState().currentTab === "production") renderProduction();
}

// src/dashboard/tabs/finance.js
function cwWeekly2(satDate) {
  return calcCWWeeklyPay({
    satDate,
    cfg: getCfg(),
    cwAtt: loadJSON(K.cwAtt, {}),
    cwAdv: loadJSON(K.cwAdv, {}),
    prodLogs: getProdLogs(),
    permSnacks: loadJSON(K.permSnack, []),
    activeCW: getActiveCW()
  });
}
function permMonthly2(date) {
  return calcPermMonthlyPay({
    date,
    today: getState().today,
    cfg: getCfg(),
    peAtt: loadJSON(K.peAtt, {}),
    peAdv: loadJSON(K.peAdv, {}),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
    guardIds: DEF_CFG.guardIds
  });
}
function dayWages(date) {
  return calcDayWages({
    date,
    cfg: getCfg(),
    cwAtt: loadJSON(K.cwAtt, {}),
    peAtt: loadJSON(K.peAtt, {}),
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards()
  });
}
function monthWages(date) {
  return calcMonthWages({
    date,
    today: getState().today,
    cfg: getCfg(),
    cwAtt: loadJSON(K.cwAtt, {}),
    peAtt: loadJSON(K.peAtt, {}),
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards()
  });
}
function renderFinance() {
  const date = getState().today;
  const dayWage = dayWages(date);
  const prod = getProdDay(date);
  const extraCost = prod?.totals?.extraCost || 0;
  const snackCost = prod?.totals?.snackCost || 0;
  document.getElementById("finCost").textContent = formatCurrency(dayWage + extraCost + snackCost);
  document.getElementById("finMonth").textContent = formatCurrency(monthWages(date));
  document.getElementById("finWage").textContent = formatCurrency(dayWage);
  document.getElementById("finExtra").textContent = formatCurrency(extraCost);
  document.getElementById("finSnack").textContent = formatCurrency(snackCost);
  const cfg = getCfg();
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  let otCost = 0;
  getActiveCW().forEach((w) => {
    const k = getAttKey("cw", w.id, date);
    const rec = cwAtt[k];
    if (rec?.otHours) otCost += sepRound(rec.otHours * cfg.hourRate);
  });
  getActivePermProd().forEach((w) => {
    const k = getAttKey("perm", w.id, date);
    const rec = peAtt[k];
    if (rec?.otHours) otCost += sepRound(rec.otHours * sepRound(cfg.permOtBaseRate / 8 * cfg.permOtMultiplier));
  });
  document.getElementById("finOT").textContent = formatCurrency(otCost);
  renderCWPayCard();
  renderPermPayCard();
  renderMonthLock();
  const exMonthEl = document.getElementById("finExportMonth");
  if (exMonthEl) {
    const month = monthOf(getState().today);
    const monthLabel = (/* @__PURE__ */ new Date(month + "-01T00:00:00")).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    exMonthEl.textContent = `Export ${monthLabel} attendance / payroll / cost data as CSV.`;
  }
}
function renderCWPayCard() {
  const satDate = getWeekEnd(getState().today);
  const data = cwWeekly2(satDate);
  const el = document.getElementById("finCWCard");
  const paid = loadJSON(K.cwPay, {});
  const isPaid = paid[satDate]?.paid || false;
  const periodLocked = isMonthLocked(monthOf(satDate));
  document.getElementById("finCWWeek").textContent = `${formatDateShort(data.monDate)}\u2013${formatDateShort(data.satDate)}`;
  let html = `<div class="card-meta mb-8">Week: ${formatDateShort(data.monDate)} \u2013 ${formatDateShort(data.satDate)}</div>`;
  data.workers.filter((w) => w.days > 0).forEach((w) => {
    const overAdv = w.advance > w.wage;
    const overBadge = overAdv ? ` <span class="badge badge-danger" data-over-advance title="Advance \u20B9${w.advance} exceeds wage \u20B9${w.wage}">\u26A0 over-advance</span>` : "";
    html += `<div class="worker-row"${overAdv ? " data-over-advance-row" : ""}>
      <span class="worker-name">${esc(w.name)}${overBadge}</span>
      <div class="text-right">
        <div class="card-label">${w.days}d ${w.otH ? "+ " + w.otH + "h OT" : ""}${w.advance ? " | Adv: " + formatCurrency(w.advance) : ""}</div>
        <div class="card-title ff-mono${overAdv ? " text-danger" : ""}">${formatCurrency(w.net)}</div>
      </div>
    </div>`;
  });
  const cwAdvTotal = data.workers.reduce((s, w) => s + w.advance, 0);
  html += `<div class="mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
    <div class="flex-between"><span class="card-label">CW Wages</span><span class="card-title ff-mono">${formatCurrency(data.cwWageTotal)}</span></div>
    ${cwAdvTotal ? `<div class="flex-between mt-4"><span class="card-label">CW Advances</span><span class="card-title ff-mono text-danger">\u2212${formatCurrency(cwAdvTotal)}</span></div>` : ""}
    ${data.extraTotal ? `<div class="flex-between mt-4"><span class="card-label">Extra (shortfall)</span><span class="card-title ff-mono text-cost">${formatCurrency(data.extraTotal)}</span></div>` : ""}
    ${data.snackTotal ? `<div class="flex-between mt-4"><span class="card-label">Snack (CW)</span><span class="card-title ff-mono">${formatCurrency(data.snackTotal)}</span></div>` : ""}
    ${data.permSnackTotal ? `<div class="flex-between mt-4"><span class="card-label">Snack (Perm)</span><span class="card-title ff-mono">${formatCurrency(data.permSnackTotal)}</span></div>` : ""}
    <div class="flex-between mt-8"><span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(data.grandTotal)}</span></div>
  </div>`;
  html += `<div class="flex-center gap-8 mt-12">`;
  if (periodLocked) {
    html += `<span class="badge badge-warning" data-cw-pay-locked>\u{1F512} Week is in a locked month</span>`;
  } else if (!isPaid) {
    html += `<button class="btn btn-secondary" ${da("recordCWAdvance", satDate)}>Record Advance</button>
      <button class="btn btn-primary" style="flex:1" ${da("markCWPaid", satDate, data.grandTotal)}>Mark as Paid (${formatCurrency(data.grandTotal)})</button>`;
  } else {
    html += `<span class="badge badge-attend">Paid on ${paid[satDate].date}</span>`;
  }
  html += `<button class="btn btn-secondary" ${da("printCWPay")}>Print</button></div>`;
  el.innerHTML = html;
}
function recordCWAdvance(satDate) {
  if (requireUnlocked(monthOf(satDate), "CW advance")) return;
  const cw = getActiveCW();
  const names = cw.map((w, i) => `${i + 1}. ${w.name}`).join("\n");
  const choice = prompt("Select CW worker number:\n" + names);
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= cw.length) {
    alert("Invalid selection.");
    return;
  }
  const worker = cw[idx];
  const amt = prompt(`Enter advance amount for ${worker.name} (\u20B9):`);
  if (!amt) return;
  const amount = parseInt(amt);
  if (isNaN(amount) || amount <= 0) {
    alert("Invalid amount.");
    return;
  }
  const cwAdv = loadJSON(K.cwAdv, {});
  const advKey = `${worker.id}_${satDate}`;
  cwAdv[advKey] = (cwAdv[advKey] || 0) + amount;
  saveJSON(K.cwAdv, cwAdv);
  const today = getState().today;
  let prod = getProdDay(today);
  if (!prod) {
    prod = window.initProdDay ? window.initProdDay() : { timeline: [] };
  }
  prod.timeline = prod.timeline || [];
  prod.timeline.push({
    time: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    type: "advance",
    text: `CW Advance \u20B9${amount} for ${worker.name} (week ${formatDateShort(satDate)})`
  });
  if (window.saveProdDay) window.saveProdDay(today, prod);
  renderFinance();
}
function markCWPaid(satDate, amount) {
  if (requireUnlocked(monthOf(satDate), "CW pay")) return;
  const paid = loadJSON(K.cwPay, {});
  paid[satDate] = { paid: true, amount: sepRound(amount), date: formatDateShort(getState().today) };
  saveJSON(K.cwPay, paid);
  renderFinance();
}
function renderPermPayCard() {
  const data = permMonthly2(getState().today);
  const el = document.getElementById("finPermCard");
  const paid = loadJSON(K.pePay, {});
  const isPaid = paid[data.month]?.paid || false;
  const periodLocked = isMonthLocked(data.month);
  const monthLabel = (/* @__PURE__ */ new Date(data.month + "-01T00:00:00")).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  document.getElementById("finPermMonth").textContent = monthLabel;
  let html = `<div class="card-meta mb-8">${monthLabel} (up to today)</div>`;
  data.workers.filter((w) => w.days > 0).forEach((w) => {
    const gross = w.basePay + w.otPay;
    const overAdv = w.advance > gross;
    const overBadge = overAdv ? ` <span class="badge badge-danger" data-over-advance title="Advance \u20B9${w.advance} exceeds gross \u20B9${gross}">\u26A0 over-advance</span>` : "";
    html += `<div class="worker-row"${overAdv ? " data-over-advance-row" : ""}>
      <div class="worker-info">
        <span class="worker-name">${esc(w.name)}${overBadge}</span>
        <span class="worker-detail">${esc(w.role || "")} \u2014 ${w.days}d${w.otH ? " +" + w.otH + "h OT" : ""}</span>
      </div>
      <div class="text-right">
        <div class="card-label">${w.advance ? "Adv: " + formatCurrency(w.advance) : ""}</div>
        <div class="card-title ff-mono${overAdv ? " text-danger" : ""}">${formatCurrency(w.total)}</div>
      </div>
    </div>`;
  });
  html += `<div class="mt-8" style="border-top:1px solid var(--border);padding-top:var(--sp-8)">
    <div class="flex-between"><span class="card-title">Total</span><span class="card-value text-cost">${formatCurrency(data.grandTotal)}</span></div>
  </div>`;
  html += `<div class="flex-center gap-8 mt-12">`;
  if (periodLocked) {
    html += `<span class="badge badge-warning" data-perm-pay-locked>\u{1F512} ${data.month} is locked</span>`;
  } else if (!isPaid) {
    html += `<button class="btn btn-secondary" ${da("recordAdvance")}>Record Advance</button>
      <button class="btn btn-primary" style="flex:1" ${da("markPermPaid", data.month, data.grandTotal)}>Mark as Paid (${formatCurrency(data.grandTotal)})</button>`;
  } else {
    html += `<span class="badge badge-attend">Paid on ${paid[data.month].date}</span>`;
  }
  html += `<button class="btn btn-secondary" ${da("printPermPay")}>Print</button></div>`;
  el.innerHTML = html;
}
function recordAdvance() {
  const today = getState().today;
  if (requireUnlocked(monthOf(today), "Perm advance")) return;
  const perm = getActivePermProd();
  const guard = getPermWorkers().filter((w) => DEF_CFG.guardIds.includes(w.id) && !w.inactive);
  const all = [...perm, ...guard];
  const names = all.map((w, i) => `${i + 1}. ${w.name}`).join("\n");
  const choice = prompt("Select worker number:\n" + names);
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= all.length) {
    alert("Invalid selection.");
    return;
  }
  const worker = all[idx];
  const amt = prompt(`Enter advance amount for ${worker.name} (\u20B9):`);
  if (!amt) return;
  const amount = parseInt(amt);
  if (isNaN(amount) || amount <= 0) {
    alert("Invalid amount.");
    return;
  }
  const d = /* @__PURE__ */ new Date(today + "T00:00:00");
  const advKey = `${worker.id}_${d.getFullYear()}_${d.getMonth() + 1}`;
  const advances = loadJSON(K.peAdv, {});
  advances[advKey] = (advances[advKey] || 0) + amount;
  saveJSON(K.peAdv, advances);
  let prod = getProdDay(today);
  if (!prod) prod = window.initProdDay ? window.initProdDay() : { timeline: [] };
  prod.timeline = prod.timeline || [];
  prod.timeline.push({
    time: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    type: "advance",
    text: `Advance \u20B9${amount} recorded for ${worker.name} (total: \u20B9${advances[advKey]})`
  });
  if (window.saveProdDay) window.saveProdDay(today, prod);
  renderFinance();
}
function markPermPaid(month, amount) {
  if (requireUnlocked(month, "Perm pay")) return;
  const paid = loadJSON(K.pePay, {});
  paid[month] = { paid: true, amount: sepRound(amount), date: formatDateShort(getState().today) };
  saveJSON(K.pePay, paid);
  renderFinance();
}
function renderMonthLock() {
  const el = document.getElementById("finMonthLock");
  if (!el) return;
  const today = getState().today;
  const d = /* @__PURE__ */ new Date(today + "T00:00:00");
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const dayOfMonth = d.getDate();
  const locks = getMonthLocks();
  if (locks[month]?.locked) {
    el.innerHTML = `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="lock-badge">\u{1F512} Month Locked</div>
          <div class="card-meta mt-4">Locked on ${locks[month].lockedAt || "\u2014"}</div>
        </div>
        <button class="btn btn-secondary btn-sm" ${da("unlockMonth", month)}>Unlock</button>
      </div>
    </div>`;
    return;
  }
  if (dayOfMonth >= 28) {
    el.innerHTML = `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="card-title">Month-End Close</div>
          <div class="card-meta mt-4">Lock ${month} to finalize records</div>
        </div>
        <button class="btn btn-primary btn-sm" ${da("lockMonth", month)}>Lock Month</button>
      </div>
    </div>`;
  } else {
    el.innerHTML = "";
  }
}
function lockMonth(month) {
  const data = permMonthly2(month + "-15");
  const cwSat = getWeekEnd(month + "-28");
  const cwData = cwWeekly2(cwSat);
  const peAtt = loadJSON(K.peAtt, {});
  const cwAtt = loadJSON(K.cwAtt, {});
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();
  let presentDays = 0;
  let absentDays = 0;
  const allProd = getAllProdWorkers();
  for (let i = 1; i <= dim; i++) {
    const ds = `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    allProd.forEach((w) => {
      const type = getPermWorkers().find((p) => p.id === w.id) ? "perm" : "cw";
      const store = type === "perm" ? peAtt : cwAtt;
      const k = getAttKey(type, w.id, ds);
      if (store[k] && (store[k].status === "P" || store[k].status === "OT")) presentDays++;
      else absentDays++;
    });
  }
  const prodLogs = getProdLogs();
  let monthExtra = 0;
  let monthSnack = 0;
  Object.keys(prodLogs).filter((d) => d.startsWith(month)).forEach((d) => {
    monthExtra += prodLogs[d]?.totals?.extraCost || 0;
    monthSnack += prodLogs[d]?.totals?.snackCost || 0;
  });
  const invoices = getInvoices();
  const monthInvs = invoices.filter((inv) => inv.date.startsWith(month));
  const invoiceTotal = monthInvs.reduce((s, inv) => s + (inv.total || 0), 0);
  const summary = {
    permTotal: data.grandTotal,
    cwTotal: cwData.cwWageTotal,
    extraTotal: monthExtra,
    snackTotal: monthSnack,
    invoiceTotal,
    presentDays,
    absentDays
  };
  const msg = `Lock ${month}?

Perm wages: ${formatCurrency(summary.permTotal)}
CW wages: ${formatCurrency(summary.cwTotal)}
Extra cost: ${formatCurrency(summary.extraTotal)}
Snack cost: ${formatCurrency(summary.snackTotal)}
Invoiced: ${formatCurrency(summary.invoiceTotal)}
Present days: ${summary.presentDays}
Absent days: ${summary.absentDays}

Attendance and production will become read-only for this month.`;
  if (!confirm(msg)) return;
  const locks = getMonthLocks();
  locks[month] = {
    locked: true,
    lockedAt: formatDateShort(getState().today),
    summary
  };
  saveJSON(K.monthLock, locks);
  renderFinance();
}
function unlockMonth(month) {
  if (!confirm(`Unlock ${month}? Records will become editable again.`)) return;
  const locks = getMonthLocks();
  delete locks[month];
  saveJSON(K.monthLock, locks);
  renderFinance();
}

// src/shared/utils/csv.js
function csvCell(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}
function csvDownload(filename, rows) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// src/dashboard/tabs/invoice.js
function renderInvoice() {
  const invoices = getInvoices();
  const clients = getClients();
  const invMonth = getState().invMonth;
  const monthInvs = invoices.filter((inv) => inv.date.startsWith(invMonth));
  const monthTotal = monthInvs.reduce((s, inv) => s + (inv.total || 0), 0);
  const unpaid = invoices.filter((inv) => inv.payStatus === "unpaid");
  const unpaidTotal = unpaid.reduce((s, inv) => s + (inv.total || 0), 0);
  document.getElementById("invMonthTotal").textContent = formatCurrency(monthTotal);
  document.getElementById("invMonthCount").textContent = `${monthInvs.length} invoices`;
  document.getElementById("invReceivables").textContent = formatCurrency(unpaidTotal);
  document.getElementById("invReceivableCount").textContent = `${unpaid.length} unpaid`;
  const panel = document.getElementById("invSubPanel");
  switch (getState().invTab) {
    case "list":
      renderInvList(panel, invoices, clients);
      break;
    case "clients":
      renderClientList(panel, clients);
      break;
    case "gst":
      renderGSTRegister(panel, invoices, clients);
      break;
  }
}
function renderInvList(el, invoices, clients) {
  if (invoices.length === 0) {
    el.innerHTML = `<div class="section-zone">
      <div class="card-info"><div class="empty-state">
        <div class="empty-state-icon">\u{1F4C4}</div>
        <div class="empty-state-text">No invoices yet</div>
        <div class="empty-state-sub">Tap "+ New Invoice" to create one</div>
      </div></div>
    </div>`;
    return;
  }
  const sorted = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.invNo.localeCompare(a.invNo));
  let html = '<div class="section-zone"><div class="section-label-md">Recent Invoices</div><div class="card-group">';
  sorted.slice(0, 20).forEach((inv) => {
    const client = clients.find((c) => c.id === inv.clientId);
    const payClass = inv.payStatus === "paid" ? "badge-attend" : inv.payStatus === "partial" ? "badge-warning" : "badge-absent";
    const payLabel = inv.payStatus === "paid" ? "Paid" : inv.payStatus === "partial" ? "Partial" : "Unpaid";
    html += `<div class="card-daily" ${da("viewInvoice", inv.id)}>
      <div class="flex-between">
        <div>
          <div class="card-title">${esc(inv.invNo)}</div>
          <div class="card-meta mt-4">${esc(client?.name || "Unknown")} \u2014 ${formatDateShort(inv.date)}</div>
        </div>
        <div class="text-right">
          <div class="card-title ff-mono">${formatCurrency(inv.total)}</div>
          <span class="badge ${payClass} mt-4">${payLabel}</span>
        </div>
      </div>
    </div>`;
  });
  html += "</div></div>";
  el.innerHTML = html;
}
function renderClientList(el, clients) {
  let html = '<div class="section-zone"><div class="flex-between"><div class="section-label-md" style="margin-bottom:0">Clients</div>';
  html += `<button class="btn btn-secondary btn-sm" ${da("addClient")}>+ Add Client</button></div></div>`;
  if (clients.length === 0) {
    html += `<div class="section-zone"><div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">\u{1F3E2}</div>
      <div class="empty-state-text">No clients yet</div>
      <div class="empty-state-sub">Add clients to start invoicing</div>
    </div></div></div>`;
    el.innerHTML = html;
    return;
  }
  html += '<div class="section-zone"><div class="card-group">';
  clients.forEach((c) => {
    const rates = getClientRates(c.id);
    const supplyType = c.stateCode === getInvCfg().stateCode ? "Intra-state" : "Inter-state";
    html += `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="card-title">${esc(c.name)}</div>
          <div class="card-meta mt-4">GSTIN: ${esc(c.gstin || "\u2014")} | ${supplyType}</div>
          <div class="card-meta">${c.billingPref || "Per dispatch"} | ${rates.length} rate${rates.length !== 1 ? "s" : ""}</div>
        </div>
        <div class="flex-center gap-4">
          <button class="btn btn-secondary btn-sm" ${da("editClientRates", c.id)}>Rates</button>
          <button class="btn btn-secondary btn-sm" ${da("editClient", c.id)}>Edit</button>
        </div>
      </div>
    </div>`;
  });
  html += "</div></div>";
  el.innerHTML = html;
}
function renderGSTRegister(el, invoices, clients) {
  const invMonth = getState().invMonth;
  let html = `<div class="section-zone">
    <div class="flex-between">
      <div class="section-label-md" style="margin-bottom:0">GST Register</div>
      <div class="flex-center gap-4">
        <button class="btn btn-secondary btn-sm" ${da("shiftGSTMonth", -1)}>\u2190 Prev</button>
        <span class="card-label ff-mono">${invMonth}</span>
        <button class="btn btn-secondary btn-sm" ${da("shiftGSTMonth", 1)}>Next \u2192</button>
      </div>
    </div>
  </div>`;
  const monthInvs = invoices.filter((inv) => inv.date.startsWith(invMonth)).sort((a, b) => a.date.localeCompare(b.date));
  if (monthInvs.length === 0) {
    html += `<div class="section-zone"><div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">\u{1F4CA}</div>
      <div class="empty-state-text">No invoices for ${invMonth}</div>
    </div></div></div>`;
    el.innerHTML = html;
    return;
  }
  const totTaxable = monthInvs.reduce((s, inv) => s + (inv.taxableValue || 0), 0);
  const totCgst = monthInvs.reduce((s, inv) => s + (inv.cgst || 0), 0);
  const totSgst = monthInvs.reduce((s, inv) => s + (inv.sgst || 0), 0);
  const totTotal = monthInvs.reduce((s, inv) => s + (inv.total || 0), 0);
  html += `<div class="section-zone"><div class="stat-grid">
    <div class="stat-pill"><span class="stat-pill-value text-cost">${formatCurrency(totTaxable)}</span><span class="stat-pill-label">Taxable</span></div>
    <div class="stat-pill"><span class="stat-pill-value text-attend">${formatCurrency(totCgst)}</span><span class="stat-pill-label">CGST</span></div>
    <div class="stat-pill"><span class="stat-pill-value text-attend">${formatCurrency(totSgst)}</span><span class="stat-pill-label">SGST</span></div>
    <div class="stat-pill"><span class="stat-pill-value text-prod">${formatCurrency(totTotal)}</span><span class="stat-pill-label">Total</span></div>
  </div></div>`;
  html += '<div class="section-zone"><div class="card-group">';
  monthInvs.forEach((inv) => {
    const client = clients.find((c) => c.id === inv.clientId);
    const supplyType = inv.igst > 0 ? "Inter" : "Intra";
    html += `<div class="card-daily">
      <div class="flex-between">
        <div>
          <div class="card-label">${esc(inv.invNo)}</div>
          <div class="card-meta">${formatDateShort(inv.date)} | ${esc(client?.name || "\u2014")} | ${supplyType}</div>
        </div>
        <div class="text-right">
          <div class="card-title ff-mono">${formatCurrency(inv.total)}</div>
          <div class="card-meta">Tax: ${formatCurrency((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0))}</div>
        </div>
      </div>
    </div>`;
  });
  html += "</div></div>";
  html += `<div class="section-zone"><button class="btn btn-secondary btn-full" ${da("exportGSTRegister")}>Export GST Register (CSV)</button></div>`;
  el.innerHTML = html;
}
function shiftGSTMonth(delta) {
  const invMonth = getState().invMonth;
  const [y, m] = invMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  setState({ invMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
  renderInvoice();
}
function addClient() {
  const name = prompt("Client name:");
  if (!name || !name.trim()) return;
  const gstin = prompt("GSTIN (15 chars, leave blank if unknown):", "") || "";
  const stateCode = prompt("State code (20=Jharkhand, 27=Maharashtra, etc):", "20") || "20";
  const billingPref = prompt("Billing preference (per dispatch / weekly / monthly):", "per dispatch") || "per dispatch";
  const clients = getClients();
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36).slice(-4);
  clients.push({
    id,
    name: name.trim(),
    gstin: gstin.trim().toUpperCase(),
    stateCode,
    billingPref,
    inactive: false
  });
  saveJSON(K.clients, clients);
  renderInvoice();
}
function editClient(clientId) {
  const clients = getClients();
  const c = clients.find((x) => x.id === clientId);
  if (!c) return;
  const name = prompt("Client name:", c.name);
  if (!name) return;
  c.name = name.trim();
  c.gstin = (prompt("GSTIN:", c.gstin) || "").trim().toUpperCase();
  c.stateCode = prompt("State code:", c.stateCode) || c.stateCode;
  c.billingPref = prompt("Billing preference:", c.billingPref) || c.billingPref;
  saveJSON(K.clients, clients);
  renderInvoice();
}
function editClientRates(clientId) {
  const clients = getClients();
  const client = clients.find((c) => c.id === clientId);
  if (!client) return;
  const rates = getRates();
  const clientRates = rates.filter((r) => r.clientId === clientId);
  const rateListText = clientRates.length ? clientRates.map((r, i) => `${i + 1}. ${r.material} \u2014 \u20B9${r.rate}/${r.unit}`).join("\n") : "(none)";
  const action = prompt(`Rates for ${client.name}:
${rateListText}

Type:
  "add" to add a rate
  "del N" to delete rate N
  or cancel`);
  if (!action) return;
  if (action.trim().toLowerCase() === "add") {
    const material = prompt('Material type (e.g. "Hex bolts", "MS parts"):');
    if (!material) return;
    const dup = clientRates.find((r) => r.material.trim().toLowerCase() === material.trim().toLowerCase());
    if (dup) {
      alert(`Rate for "${material.trim()}" already exists for ${client.name} (\u20B9${dup.rate}/${dup.unit}). Delete the existing rate first ("del N"), then add the new one.`);
      return;
    }
    const unit = prompt("Unit (kg or pc):", "kg") || "kg";
    const rate = parseFloat(prompt("Rate per " + unit + " (\u20B9):", "10"));
    if (isNaN(rate) || rate <= 0) {
      alert("Invalid rate.");
      return;
    }
    const rateId = `${clientId}_${Date.now().toString(36).slice(-4)}`;
    rates.push({ id: rateId, clientId, material: material.trim(), unit, rate, effectiveFrom: getState().today });
    saveJSON(K.rates, rates);
  } else if (action.trim().toLowerCase().startsWith("del")) {
    const idx = parseInt(action.trim().slice(3)) - 1;
    if (isNaN(idx) || idx < 0 || idx >= clientRates.length) {
      alert("Invalid number.");
      return;
    }
    const delId = clientRates[idx].id;
    const filtered = rates.filter((r) => r.id !== delId);
    saveJSON(K.rates, filtered);
  }
  renderInvoice();
}
function editInvConfig() {
  const cfg = getInvCfg();
  const companyName = prompt("Company name:", cfg.companyName);
  if (!companyName) return;
  cfg.companyName = companyName.trim();
  cfg.gstin = (prompt("GSTIN (15 chars):", cfg.gstin) || "").trim().toUpperCase();
  cfg.stateCode = prompt("State code (20=Jharkhand):", cfg.stateCode) || cfg.stateCode;
  cfg.sac = prompt("SAC code:", cfg.sac) || cfg.sac;
  const gstRate = parseInt(prompt("GST rate %:", cfg.gstRate));
  if (!isNaN(gstRate) && gstRate > 0) cfg.gstRate = gstRate;
  cfg.seriesPrefix = prompt("Invoice series prefix:", cfg.seriesPrefix) || cfg.seriesPrefix;
  const nextNum = parseInt(prompt("Next invoice number:", cfg.nextNumber));
  if (!isNaN(nextNum) && nextNum > 0) cfg.nextNumber = nextNum;
  cfg.bankName = prompt("Bank name:", cfg.bankName || "") || "";
  cfg.bankAccount = prompt("Bank account no:", cfg.bankAccount || "") || "";
  cfg.bankIFSC = prompt("IFSC code:", cfg.bankIFSC || "") || "";
  saveJSON(K.invCfg, cfg);
  if (typeof window.closeSettings === "function") window.closeSettings();
  if (typeof window.openSettings === "function") window.openSettings();
}
function exportGSTRegister() {
  const invoices = getInvoices();
  const clients = getClients();
  const invMonth = getState().invMonth;
  const monthInvs = invoices.filter((inv) => inv.date.startsWith(invMonth)).sort((a, b) => a.date.localeCompare(b.date));
  if (monthInvs.length === 0) {
    alert("No invoices for this month.");
    return;
  }
  const headers = ["Invoice No", "Date", "Client Name", "Client GSTIN", "SAC", "Supply Type", "Taxable Value", "CGST", "SGST", "IGST", "Total", "Payment Status"];
  const dataRows = monthInvs.map((inv) => {
    const client = clients.find((c) => c.id === inv.clientId);
    return [
      inv.invNo,
      inv.date,
      client?.name || inv.clientName,
      inv.clientGstin || "",
      inv.sac,
      inv.supplyType === "inter" ? "Inter-state" : "Intra-state",
      inv.taxableValue,
      inv.cgst || 0,
      inv.sgst || 0,
      inv.igst || 0,
      inv.total,
      inv.payStatus
    ];
  });
  csvDownload(`SEP_GST_Register_${invMonth}.csv`, [headers, ...dataRows]);
}
function initInvoiceSubtabHandler() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-invtab]");
    if (!btn || !btn.closest("#tab-invoice")) return;
    setState({ invTab: btn.dataset.invtab });
    btn.closest(".flex-center").querySelectorAll(".nb").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderInvoice();
  });
}

// src/dashboard/tabs/stock.js
function renderStock() {
  const stock = getStock();
  const listEl = document.getElementById("stockList");
  const lowCount = stock.filter((s) => s.qty > 0 && s.qty <= s.threshold).length;
  const outCount = stock.filter((s) => s.qty <= 0).length;
  const overCount = stock.filter((s) => s.maxQty && s.qty > s.maxQty).length;
  const statusEl = document.getElementById("stockStatus");
  const detailEl = document.getElementById("stockDetail");
  const alertCount = lowCount + outCount + overCount;
  if (alertCount > 0) {
    statusEl.textContent = `${alertCount} item${alertCount !== 1 ? "s" : ""} need attention`;
    statusEl.className = "card-value-xl text-danger";
    const parts = [];
    if (lowCount) parts.push(`${lowCount} low`);
    if (outCount) parts.push(`${outCount} out`);
    if (overCount) parts.push(`${overCount} over limit`);
    detailEl.textContent = parts.join(", ");
  } else {
    statusEl.textContent = "All OK";
    statusEl.className = "card-value-xl text-attend";
    detailEl.textContent = `${stock.length} items tracked`;
  }
  listEl.innerHTML = stock.map((item) => {
    const pct = item.threshold > 0 ? item.qty / item.threshold : 1;
    const isOverLimit = item.maxQty && item.qty > item.maxQty;
    const color = isOverLimit ? "text-danger" : item.qty <= 0 ? "text-danger" : pct <= 1 ? "text-warn" : "text-attend";
    const limitInfo = item.maxQty ? ` | Max: ${item.maxQty} ${item.unit}` : "";
    return `<div class="card-base">
      <div class="flex-between">
        <div>
          <div class="card-title">${esc(item.name)}</div>
          <div class="card-meta mt-4">Min: ${item.threshold} ${item.unit}${limitInfo}</div>
          ${isOverLimit ? `<div class="card-meta text-danger mt-4">\u26A0 Over regulatory limit</div>` : ""}
        </div>
        <div class="text-right">
          <div class="card-value ff-mono ${color}">${item.qty}</div>
          <div class="card-label">${item.unit}</div>
        </div>
      </div>
      <div class="mt-8 flex-center gap-4">
        <button class="btn btn-secondary btn-sm" ${da("updateStock", item.id, -1)}>\u2212</button>
        <button class="btn btn-secondary btn-sm" ${da("updateStock", item.id, 1)}>+</button>
        <button class="btn btn-secondary btn-sm" ${da("editStockQty", item.id)}>Set</button>
      </div>
    </div>`;
  }).join("");
}
function updateStock(itemId, delta) {
  const stock = getStock();
  const item = stock.find((s) => s.id === itemId);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  saveJSON(K.stock, stock);
  const log = getStockLog();
  log.push({
    id: itemId,
    name: item.name,
    delta,
    newQty: item.qty,
    date: getState().today,
    time: tnow()
  });
  saveJSON(K.stockLog, log);
  renderStock();
  if (getState().currentTab === "home") renderHome();
}
function editStockQty(itemId) {
  const stock = getStock();
  const item = stock.find((s) => s.id === itemId);
  if (!item) return;
  const val = prompt(`Set ${item.name} quantity (${item.unit}):`, item.qty);
  if (val === null) return;
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return;
  const oldQty = item.qty;
  item.qty = n;
  saveJSON(K.stock, stock);
  const log = getStockLog();
  log.push({
    id: itemId,
    name: item.name,
    delta: n - oldQty,
    newQty: n,
    date: getState().today,
    time: tnow()
  });
  saveJSON(K.stockLog, log);
  renderStock();
}

// src/dashboard/tabs/history.js
function renderHistory() {
  const date = getState().histDate;
  const histMonth = monthOf(date);
  const histMonthLocked = isMonthLocked(histMonth);
  const lockSummary = histMonthLocked ? getMonthLocks()[histMonth]?.summary : null;
  document.getElementById("histDate").textContent = formatDate(date);
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const prod = getProdDay(date);
  const dayWage = calcDayWages({
    date,
    cfg: getCfg(),
    cwAtt,
    peAtt,
    activeCW: getActiveCW(),
    activePermProd: getActivePermProd(),
    guards: getGuards()
  });
  let present = 0;
  getAllProdWorkers().forEach((w) => {
    const attStore = w.type === "perm" ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    if (attStore[k] && attStore[k].status !== "A") present++;
  });
  document.getElementById("histSummary").textContent = present > 0 ? `${present} workers` : "\u2014";
  const el = document.getElementById("histData");
  if (present === 0 && !prod && !histMonthLocked) {
    el.innerHTML = `<div class="card-info"><div class="empty-state">
      <div class="empty-state-icon">\u{1F4CA}</div>
      <div class="empty-state-text">No data for this date</div>
      <div class="empty-state-sub">Navigate to a date with recorded data</div>
    </div></div>`;
    return;
  }
  let html = "";
  if (histMonthLocked) {
    const lockedAt = getMonthLocks()[histMonth]?.lockedAt || "\u2014";
    html += `<div class="card-base" data-history-locked-card>
      <div class="flex-between">
        <div class="lock-badge">\u{1F512} ${histMonth} Locked</div>
        <span class="card-meta">Locked on ${lockedAt}</span>
      </div>`;
    if (lockSummary) {
      html += `<div class="mt-8 stat-grid">
        <div class="stat-pill"><span class="stat-pill-value text-cost ff-mono">${formatCurrency((lockSummary.permTotal || 0) + (lockSummary.cwTotal || 0) + (lockSummary.extraTotal || 0) + (lockSummary.snackTotal || 0))}</span><span class="stat-pill-label">Month wage cost</span></div>
        <div class="stat-pill"><span class="stat-pill-value ff-mono">${formatCurrency(lockSummary.invoiceTotal || 0)}</span><span class="stat-pill-label">Invoiced</span></div>
        <div class="stat-pill"><span class="stat-pill-value text-attend ff-mono">${lockSummary.presentDays || 0}</span><span class="stat-pill-label">Present-days</span></div>
        <div class="stat-pill"><span class="stat-pill-value text-danger ff-mono">${lockSummary.absentDays || 0}</span><span class="stat-pill-label">Absent-days</span></div>
      </div>`;
    }
    html += `<div class="card-meta mt-8">Records below are read-only \u2014 edit controls suppressed for locked months.</div>
    </div>`;
  }
  html += `<div class="card-base">
    <div class="card-title">Attendance</div>
    <div class="mt-8 stat-grid">
      <div class="stat-pill"><span class="stat-pill-value text-attend">${present}</span><span class="stat-pill-label">Present</span></div>
      <div class="stat-pill"><span class="stat-pill-value text-cost">${formatCurrency(dayWage)}</span><span class="stat-pill-label">Wage Cost</span></div>
    </div>
  </div>`;
  if (prod) {
    html += `<div class="card-base mt-12">
      <div class="card-title">Production</div>
      <div class="card-label mt-8">Pieces: ${prod.totals?.pieces || 0} | Weight: ${prod.totals?.weight || 0} kg</div>
      <div class="card-meta mt-4">Extra: ${formatCurrency(prod.totals?.extraCost || 0)} | Snack: ${formatCurrency(prod.totals?.snackCost || 0)}</div>
    </div>`;
  }
  html += `<div class="card-daily mt-12">
    <div class="card-title">Worker Details</div>`;
  getAllProdWorkers().forEach((w) => {
    const attStore = w.type === "perm" ? peAtt : cwAtt;
    const k = getAttKey(w.type, w.id, date);
    const rec = attStore[k];
    if (!rec) return;
    const typeCls = w.type === "perm" ? "badge-perm" : "badge-cw";
    const statusCls = rec.status === "A" ? "text-danger" : "text-attend";
    html += `<div class="worker-row">
      <span class="worker-name">${esc(w.name)} <span class="badge ${typeCls}">${w.type === "perm" ? "P" : "C"}</span></span>
      <span class="${statusCls}" style="margin-left:auto">${rec.status}${rec.otHours ? " +" + rec.otHours + "h OT" : ""}</span>
    </div>`;
  });
  html += `</div>`;
  el.innerHTML = html;
}
function initHistoryNav() {
  document.getElementById("histPrev")?.addEventListener("click", () => {
    const d = /* @__PURE__ */ new Date(getState().histDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setState({ histDate: localDateStr(d) });
    renderHistory();
  });
  document.getElementById("histNext")?.addEventListener("click", () => {
    const d = /* @__PURE__ */ new Date(getState().histDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setState({ histDate: localDateStr(d) });
    renderHistory();
  });
}

// src/dashboard/tabs/finance-export.js
function exportAttendanceCSV() {
  const month = monthOf(getState().today);
  const dates = monthDates(month);
  const cwAtt = loadJSON(K.cwAtt, {});
  const peAtt = loadJSON(K.peAtt, {});
  const cw = getActiveCW();
  const perm = getActivePermProd();
  const guard = getPermWorkers().filter((w) => DEF_CFG.guardIds.includes(w.id) && !w.inactive);
  const all = [
    ...perm.map((w) => ({ ...w, type: "perm" })),
    ...guard.map((w) => ({ ...w, type: "perm" })),
    ...cw.map((w) => ({ ...w, type: "cw" }))
  ];
  const rows = [["Worker ID", "Worker Name", "Type", "Date", "Status", "OT Hours"]];
  let dataRowCount = 0;
  for (const w of all) {
    const store = w.type === "perm" ? peAtt : cwAtt;
    for (const ds of dates) {
      const k = getAttKey(w.type, w.id, ds);
      const rec = store[k];
      if (!rec) continue;
      rows.push([w.id, w.name, w.type === "perm" ? "Perm" : "CW", ds, rec.status || "", rec.otHours || 0]);
      dataRowCount++;
    }
  }
  if (dataRowCount === 0) {
    alert(`No attendance recorded for ${month}.`);
    return;
  }
  csvDownload(`SEP_attendance_${month}.csv`, rows);
}
function exportPayrollCSV() {
  const month = monthOf(getState().today);
  const today = getState().today;
  const perm = calcPermMonthlyPay({
    date: today,
    today,
    cfg: getCfg(),
    peAtt: loadJSON(K.peAtt, {}),
    peAdv: loadJSON(K.peAdv, {}),
    activePermProd: getActivePermProd(),
    guards: getGuards(),
    guardIds: DEF_CFG.guardIds
  });
  const cwAggMap = {};
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const sat = getWeekEnd(ds);
    if (!sat.startsWith(month)) continue;
    if (cwAggMap[`__week_${sat}`]) continue;
    cwAggMap[`__week_${sat}`] = true;
    const wk = calcCWWeeklyPay({
      satDate: sat,
      cfg: getCfg(),
      cwAtt: loadJSON(K.cwAtt, {}),
      cwAdv: loadJSON(K.cwAdv, {}),
      prodLogs: getProdLogs(),
      permSnacks: loadJSON(K.permSnack, []),
      activeCW: getActiveCW()
    });
    for (const w of wk.workers) {
      if (!cwAggMap[w.id]) cwAggMap[w.id] = { name: w.name, days: 0, otH: 0, wage: 0, advance: 0, net: 0 };
      const a = cwAggMap[w.id];
      a.days += w.days;
      a.otH += w.otH;
      a.wage += w.wage;
      a.advance += w.advance;
      a.net += w.net;
    }
  }
  const rows = [["Worker ID", "Worker Name", "Type", "Days", "Gross", "OT Hours", "Advance", "Net"]];
  for (const w of perm.workers) {
    if (w.days === 0 && w.advance === 0) continue;
    rows.push([w.id, w.name, "Perm", w.days, sepRound(w.basePay + w.otPay), w.otH, w.advance, w.total]);
  }
  for (const wid of Object.keys(cwAggMap)) {
    if (wid.startsWith("__week_")) continue;
    const a = cwAggMap[wid];
    if (a.days === 0 && a.advance === 0) continue;
    rows.push([wid, a.name, "CW", a.days, sepRound(a.wage), a.otH, a.advance, sepRound(a.net)]);
  }
  if (rows.length === 1) {
    alert(`No payroll data for ${month}.`);
    return;
  }
  csvDownload(`SEP_payroll_${month}.csv`, rows);
}
function exportCostsCSV() {
  const month = monthOf(getState().today);
  const dates = monthDates(month);
  const rows = [["Date", "Day Wages", "Extra Cost", "Snack Cost", "OT Cost", "Total"]];
  let nonzeroCount = 0;
  for (const ds of dates) {
    const dayWage = calcDayWages({
      date: ds,
      cfg: getCfg(),
      cwAtt: loadJSON(K.cwAtt, {}),
      peAtt: loadJSON(K.peAtt, {}),
      activeCW: getActiveCW(),
      activePermProd: getActivePermProd(),
      guards: getGuards()
    });
    const prod = getProdDay(ds);
    const extra = prod?.totals?.extraCost || 0;
    const snack = prod?.totals?.snackCost || 0;
    const cfg = getCfg();
    const cwAtt = loadJSON(K.cwAtt, {});
    const peAtt = loadJSON(K.peAtt, {});
    let otCost = 0;
    for (const w of getActiveCW()) {
      const k = getAttKey("cw", w.id, ds);
      const rec = cwAtt[k];
      if (rec?.otHours) otCost += sepRound(rec.otHours * cfg.hourRate);
    }
    for (const w of getActivePermProd()) {
      const k = getAttKey("perm", w.id, ds);
      const rec = peAtt[k];
      if (rec?.otHours) otCost += sepRound(rec.otHours * sepRound(cfg.permOtBaseRate / 8 * cfg.permOtMultiplier));
    }
    const total = dayWage + extra + snack + otCost;
    if (total === 0) continue;
    rows.push([ds, dayWage, extra, snack, otCost, total]);
    nonzeroCount++;
  }
  if (nonzeroCount === 0) {
    alert(`No cost data for ${month}.`);
    return;
  }
  csvDownload(`SEP_costs_${month}.csv`, rows);
}

// src/dashboard/main.js
var TAB_ORDER = ["home", "attendance", "production", "finance", "invoice", "stock", "history"];
function switchTab(tabId) {
  setState({ currentTab: tabId });
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabId}`));
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  renderTab(tabId);
}
function renderTab(tabId) {
  switch (tabId) {
    case "home":
      renderHome();
      break;
    case "attendance":
      renderAttendance();
      break;
    case "production":
      renderProduction();
      break;
    case "finance":
      renderFinance();
      break;
    case "invoice":
      renderInvoice();
      break;
    case "stock":
      renderStock();
      break;
    case "history":
      renderHistory();
      break;
  }
}
function initTabRouting() {
  document.getElementById("tabBar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn) switchTab(btn.dataset.tab);
  });
  let swipeX = 0;
  let swipeY = 0;
  let swipeT = 0;
  const tabContent = document.querySelector(".tab-content");
  tabContent?.addEventListener("touchstart", (e) => {
    swipeX = e.changedTouches[0].screenX;
    swipeY = e.changedTouches[0].screenY;
    swipeT = Date.now();
  }, { passive: true });
  tabContent?.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].screenX - swipeX;
    const dy = e.changedTouches[0].screenY - swipeY;
    if (Date.now() - swipeT > 400 || Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const idx = TAB_ORDER.indexOf(getState().currentTab);
    if (dx < -80 && idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]);
    else if (dx > 80 && idx > 0) switchTab(TAB_ORDER[idx - 1]);
  }, { passive: true });
}
function initData() {
  if (!localStorage.getItem(K.peEmp)) saveJSON(K.peEmp, DEF_PERM);
  if (!localStorage.getItem(K.cwEmp)) saveJSON(K.cwEmp, DEF_CW);
  if (!localStorage.getItem(K.prodAreas)) saveJSON(K.prodAreas, DEF_AREAS);
  if (!localStorage.getItem(K.prodCfg)) saveJSON(K.prodCfg, DEF_CFG);
  if (!localStorage.getItem(K.stock)) saveJSON(K.stock, DEF_STOCK);
  if (!localStorage.getItem(K.invCfg)) saveJSON(K.invCfg, DEF_INV_CFG);
}
function initDataActionDelegation() {
  document.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (actionEl) {
      const fn = window[actionEl.dataset.action];
      if (typeof fn === "function") {
        e.preventDefault();
        const args = actionEl.dataset.args ? JSON.parse(actionEl.dataset.args) : [];
        fn.apply(actionEl, args);
        return;
      }
    }
    const overlayClose2 = e.target.dataset?.overlayClose;
    if (overlayClose2) {
      const fn = window[overlayClose2];
      if (typeof fn === "function") fn();
    }
  });
}
function exposeWindowSurface() {
  Object.assign(window, {
    // App shell
    APP_VERSION,
    switchTab,
    renderTab,
    // Save indicator + dark mode
    toggleDarkMode,
    // Storage helpers used by some inline handlers
    saveProdDay,
    initProdDay,
    // FAB
    toggleFab,
    closeFab,
    // Picker
    openPicker,
    togglePickerWorker,
    closePicker,
    // Settings + data
    openSettings,
    closeSettings,
    addWorkerPrompt,
    toggleWorkerActive,
    getStorageUsed,
    exportData,
    importData,
    resetAllData,
    // Print
    printCWPay,
    printPermPay,
    // Invoice form
    openInvoiceModal,
    closeInvModal,
    onInvClientChange,
    addInvLine,
    onRateSelect,
    recalcInvPreview,
    submitInvoiceForm,
    removeInvLine,
    // Invoice detail
    viewInvoice,
    closeInvDetail,
    markInvPaid,
    markInvPartial,
    // Tab renders (callable from FAB / cross-tab refresh)
    renderHome,
    renderAttendance,
    renderProduction,
    renderFinance,
    renderInvoice,
    renderStock,
    renderHistory,
    // Attendance + Production
    markAtt,
    lockProdAtt,
    unlockProdAtt,
    togglePeriod,
    setProdCap2,
    showProdConfirm,
    cancelConfirm,
    confirmProduction,
    logProdEntry,
    toggleHoliday,
    markAllPresent,
    addProdNote,
    markAttFromProduction,
    // Finance
    recordCWAdvance,
    markCWPaid,
    recordAdvance,
    markPermPaid,
    lockMonth,
    unlockMonth,
    // Invoice tab CRUD
    shiftGSTMonth,
    addClient,
    editClient,
    editClientRates,
    editInvConfig,
    exportGSTRegister,
    // Stock
    updateStock,
    editStockQty,
    // Finance exports
    exportAttendanceCSV,
    exportPayrollCSV,
    exportCostsCSV
  });
}
function boot() {
  document.getElementById("headerDate").textContent = formatDate(getState().today);
  exposeWindowSurface();
  initSaveDot();
  initDarkMode();
  initData();
  initTabRouting();
  initAttendanceFilter();
  initInvoiceSubtabHandler();
  initHistoryNav();
  initSettingsBackHandler();
  initDataActionDelegation();
  const fabAction = initFab({
    markAllPresent,
    goAttendance: () => switchTab("attendance"),
    goProduction: () => switchTab("production"),
    addNote: addProdNote,
    toggleHoliday
  });
  window.fabAction = fabAction;
  renderTab("home");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
    });
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
//# sourceMappingURL=dashboard.js.map
