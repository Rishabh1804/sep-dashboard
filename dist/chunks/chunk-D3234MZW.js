// src/shared/config/workers.js
var DEF_PERM = [
  // Permanent — monthly salary. dailyRate per the ratified 1 Apr 2026 card.
  { id: "shyam_bera", name: "Shyam", role: "Production Supervisor + Barrel Lead", dailyRate: 576, inactive: false },
  { id: "sharat_mahato", name: "Sarat", role: "VAT A1 Lead", dailyRate: 500, inactive: false },
  { id: "rupa_bera", name: "Rupa", role: "VAT A2 Lead", dailyRate: 500, inactive: false },
  { id: "sunil_mahato", name: "Sunil", role: "Barrel Floor", dailyRate: 470, inactive: false },
  { id: "suklal", name: "Suklal", role: "Pickling Lead", dailyRate: 440, inactive: false },
  { id: "uday", name: "Uday", role: "Day Guard", dailyRate: 300, inactive: false },
  // Permanent contract tier — job-work, monthly (= daily rate × 30), flex
  // VAT/Barrel, explicitly NOT pickling (roles-responsibilities-v1.1 §"Three
  // workers"). Same monthly-salary treatment here as the rows above; the tier
  // distinction lives in the codex, which is where comp decisions are made.
  { id: "lk_das", name: "Lakhi", role: "Job Work \u2014 flex VAT / Barrel", dailyRate: 420, inactive: false },
  { id: "bp_sharma", name: "Bhanu", role: "Job Work \u2014 flex VAT / Barrel", dailyRate: 410, inactive: false },
  { id: "lal", name: "Lal", role: "Job Work \u2014 flex VAT / Barrel", dailyRate: 360, inactive: false },
  // Off-roll. Kept for historical attendance; excluded via DEF_CFG.excludedIds.
  { id: "rounak", name: "Rounak", role: "Data Admin", dailyRate: 0, inactive: true }
];
var DEF_CW = [
  { id: "shambhu", name: "Sambhu", inactive: false },
  { id: "sripati", name: "Sripati", inactive: false },
  // 'Budheswer' is the floor spelling and the join key: a census across
  // soma-internal `attendance/` returns Budheswer 131 · Buddheswar 0 ·
  // Budheshwar 2, and `attendance-register-data.json` keys Budheswer. (The
  // alias file's "Floor / attendance name" column says Buddheswar — that is
  // drift in the alias file, confirmed by Castor at the 21 Sep audit.)
  { id: "budheswar", name: "Budheswer", inactive: false },
  { id: "birsa", name: "Birsa", inactive: false },
  { id: "rocky", name: "Rocky", inactive: false },
  { id: "champai", name: "Champai", inactive: false },
  { id: "sai", name: "Sai", inactive: false },
  { id: "naren", name: "Naren", inactive: false },
  { id: "mantu", name: "Montu", inactive: false },
  // Joined after the original seed. Both evidenced contract-daily by their
  // presence on the weekly cash payout, which is itself the contract-tier
  // instrument (staff-aliases.md, Castor C-2 28 Jul).
  { id: "rakesh", name: "Rakesh", inactive: false },
  // joined W22
  { id: "vijay", name: "Vijay", inactive: false },
  // joined 14 Jul 2026
  // Off active pool (staff-aliases.md § "Workers off active pool").
  { id: "kusu", name: "Kusu", inactive: true },
  // 0% W20, 5+ consecutive absences
  { id: "tuklu", name: "Tuklu", inactive: true }
  // AWOL confirmed 18 May 2026
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
//# sourceMappingURL=chunk-D3234MZW.js.map
