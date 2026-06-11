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

// src/shared/config/stock.js
var DEF_STOCK = [
  { id: "zinc_anodes", name: "Zinc Anodes", unit: "kg", qty: 0, threshold: 50, category: "chemical" },
  { id: "growel_1728", name: "Growel 1728", unit: "L", qty: 0, threshold: 10, category: "chemical" },
  { id: "sodium_cyanide", name: "Sodium Cyanide", unit: "kg", qty: 0, threshold: 20, maxQty: 100, category: "chemical" },
  { id: "sodium_hydroxide", name: "Sodium Hydroxide", unit: "kg", qty: 0, threshold: 30, category: "chemical" },
  { id: "brightener", name: "Brightener", unit: "L", qty: 0, threshold: 5, category: "chemical" },
  { id: "hcl", name: "HCl", unit: "L", qty: 0, threshold: 20, category: "chemical" }
];

export {
  DEF_PERM,
  DEF_CW,
  DEF_STOCK
};
//# sourceMappingURL=chunk-JR6KBK3Q.js.map
