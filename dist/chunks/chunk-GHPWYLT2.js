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
var APP_VERSION = "2.1.0-alpha.8";
var BUILD = 5;

// src/shared/types/rule-bounds.js
var QTY_MAX = 1e5;
var PCS_MAX = 1e6;
var DFT_MICRON_MAX = 50;
var RULE_STATIONS = ["pickling", "plating", "inspection", "dispatch"];
var JOB_ROUTES = ["standard", "rework-active", "rework-completed"];
var DEPLETION_REASONS = ["production_use", "waste", "spillage", "theft", "other"];
var COST_UNITS = ["per_kg", "per_bag", "per_liter"];
var DFT_OUTCOMES = ["pass", "fail-rework"];
var NOTE_STATUSES = ["active", "resolved", "archived"];
var NOTE_PRIORITIES = ["normal", "urgent"];
var MACHINE_STATES = ["running", "idle", "down"];
var CHECK_DIRECTIONS = ["in", "out"];
var CHECK_SLOTS = ["morning_ot", "regular", "evening_ot"];
function deriveTotalQty(f = {}) {
  if (f.quantity != null && String(f.quantity).trim() !== "") return Number(f.quantity);
  const rounds = Number(f.rounds);
  const roundSize = Number(f.round_size);
  if (rounds > 0 && roundSize > 0) return rounds * roundSize;
  return void 0;
}

export {
  DEF_AREAS,
  DEF_STOCK,
  APP_VERSION,
  BUILD,
  QTY_MAX,
  PCS_MAX,
  DFT_MICRON_MAX,
  RULE_STATIONS,
  JOB_ROUTES,
  DEPLETION_REASONS,
  COST_UNITS,
  DFT_OUTCOMES,
  NOTE_STATUSES,
  NOTE_PRIORITIES,
  MACHINE_STATES,
  CHECK_DIRECTIONS,
  CHECK_SLOTS,
  deriveTotalQty
};
//# sourceMappingURL=chunk-GHPWYLT2.js.map
