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
//# sourceMappingURL=chunk-IIQMR7WS.js.map
