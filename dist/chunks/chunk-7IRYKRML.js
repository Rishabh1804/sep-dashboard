// src/shared/config/workers.js
var DEF_PERM = [
  // Permanent — monthly tier, paid per day worked.
  { id: "shyam_bera", name: "Shyam", role: "Production Supervisor + Barrel Lead", inactive: false },
  { id: "sharat_mahato", name: "Sarat", role: "VAT A1 Lead", inactive: false },
  { id: "rupa_bera", name: "Rupa", role: "VAT A2 Lead", inactive: false },
  { id: "sunil_mahato", name: "Sunil", role: "Barrel Floor", inactive: false },
  { id: "suklal", name: "Suklal", role: "Pickling Lead", inactive: false },
  // Non-floor staff on the plain monthly model (monthly wage ÷ days in the
  // month; hourly = that ÷ shiftHours, no multiplier — see utils/payroll.js).
  // The wage itself arrives through the roster import.
  { id: "uday", name: "Uday", role: "Day Guard", shiftHours: 12, payModel: "monthly-plain", inactive: false },
  // Permanent contract tier — job-work, flex VAT/Barrel, NOT pickling.
  { id: "lk_das", name: "Lakhi", role: "Job Work \u2014 flex VAT / Barrel", inactive: false },
  { id: "bp_sharma", name: "Bhanu", role: "Job Work \u2014 flex VAT / Barrel", inactive: false },
  { id: "lal", name: "Lal", role: "Job Work \u2014 flex VAT / Barrel", inactive: false },
  // Monthly tier from September 2026. His pre-September attendance is keyed
  // under the contract map (`cwAtt`), so a recompute of an August week here
  // reads zero for him; earlier weeks come from the codex, not this app.
  { id: "shambhu", name: "Sambhu", role: "Pickling anchor \u2014 flexes", inactive: false },
  // Off-roll. Kept for historical attendance; excluded via DEF_CFG.excludedIds.
  { id: "rounak", name: "Rounak", role: "Data Admin", inactive: true }
];
var DEF_CW = [
  { id: "sripati", name: "Sripati", inactive: false },
  { id: "budheswar", name: "Budheswer", inactive: false },
  { id: "birsa", name: "Birsa", inactive: false },
  { id: "rocky", name: "Rocky", inactive: false },
  { id: "champai", name: "Champai", inactive: false },
  { id: "sai", name: "Sai", inactive: false },
  { id: "naren", name: "Naren", inactive: false },
  { id: "mantu", name: "Montu", inactive: false },
  { id: "rakesh", name: "Rakesh", inactive: false },
  { id: "vijay", name: "Vijay", inactive: false },
  // Off the active pool.
  { id: "kusu", name: "Kusu", inactive: true },
  { id: "tuklu", name: "Tuklu", inactive: true }
];

// src/shared/utils/format.js
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s) {
  return esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export {
  DEF_PERM,
  DEF_CW,
  esc,
  escAttr
};
//# sourceMappingURL=chunk-7IRYKRML.js.map
