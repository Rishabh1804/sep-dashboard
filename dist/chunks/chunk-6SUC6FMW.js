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

// src/shared/config/stock.js
var DEF_STOCK = [
  { id: "zinc_anodes", name: "Zinc Anodes", unit: "kg", qty: 0, threshold: 50, category: "chemical" },
  { id: "growel_1728", name: "Growel 1728", unit: "L", qty: 0, threshold: 10, category: "chemical" },
  { id: "sodium_cyanide", name: "Sodium Cyanide", unit: "kg", qty: 0, threshold: 20, maxQty: 100, category: "chemical" },
  { id: "sodium_hydroxide", name: "Sodium Hydroxide", unit: "kg", qty: 0, threshold: 30, category: "chemical" },
  { id: "brightener", name: "Brightener", unit: "L", qty: 0, threshold: 5, category: "chemical" },
  { id: "hcl", name: "HCl", unit: "L", qty: 0, threshold: 20, category: "chemical" }
];

// src/shared/config/app.js
var APP_VERSION = "2.1.0-alpha.1";

export {
  DEF_PERM,
  DEF_CW,
  DEF_AREAS,
  DEF_STOCK,
  APP_VERSION
};
//# sourceMappingURL=chunk-6SUC6FMW.js.map
