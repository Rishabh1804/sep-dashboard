// Default rosters seeded into localStorage on first run (`initData`).
// Once persisted, edits via Settings flow through storage/workers.js.
//
// ── NO PAY DATA SHIPS HERE ─────────────────────────────────────────────────
// This repo is public. Under the Director's sensitive-data rule (24 Sep 2026;
// soma-internal `docs/CROSS_REPO_SESSIONS.md` rule 3) business data never enters
// it: what each person is paid arrives at RUNTIME through Settings → Import
// roster, from a file soma-internal generates and keeps. This file ships
// STRUCTURE only — ids, display names, roles, tiers, pay model, shift length.
// A device keeps the rates it already holds (a transfer is a copy); an import
// replaces them. The roster record, the rate card and every note about a person
// live in soma-internal (`operations/staff-aliases.md`, `decisions/`).
//
// ── IDs ARE LOAD-BEARING. NEVER RENAME ONE. ─────────────────────────────────
// A worker id is a Firestore doc path segment (`workers/{id}/shifts/...`) and
// the prefix of every localStorage attendance key (`{id}_2026_08_24`), so an
// id change orphans that worker's history. Where the canonical spelling
// differs from an id, the DISPLAY NAME moves and the id stays. It is also the
// key the roster import matches on.
//
// Workers off the active pool are marked `inactive`, never deleted: deleting a
// row would orphan the historical attendance keyed to its id.

export const DEF_PERM = [
  // Permanent — monthly tier, paid per day worked.
  { id: 'shyam_bera',    name: 'Shyam',  role: 'Production Supervisor + Barrel Lead', inactive: false },
  { id: 'sharat_mahato', name: 'Sarat',  role: 'VAT A1 Lead',    inactive: false },
  { id: 'rupa_bera',     name: 'Rupa',   role: 'VAT A2 Lead',    inactive: false },
  { id: 'sunil_mahato',  name: 'Sunil',  role: 'Barrel Floor',   inactive: false },
  { id: 'suklal',        name: 'Suklal', role: 'Pickling Lead',  inactive: false },
  // Non-floor staff on the plain monthly model (monthly wage ÷ days in the
  // month; hourly = that ÷ shiftHours, no multiplier — see utils/payroll.js).
  // The wage itself arrives through the roster import.
  { id: 'uday',          name: 'Uday',   role: 'Day Guard',      shiftHours: 12, payModel: 'monthly-plain', inactive: false },
  // Permanent contract tier — job-work, flex VAT/Barrel, NOT pickling.
  { id: 'lk_das',        name: 'Lakhi',  role: 'Job Work — flex VAT / Barrel', inactive: false },
  { id: 'bp_sharma',     name: 'Bhanu',  role: 'Job Work — flex VAT / Barrel', inactive: false },
  { id: 'lal',           name: 'Lal',    role: 'Job Work — flex VAT / Barrel', inactive: false },
  // Monthly tier from September 2026. His pre-September attendance is keyed
  // under the contract map (`cwAtt`), so a recompute of an August week here
  // reads zero for him; earlier weeks come from the codex, not this app.
  { id: 'shambhu',       name: 'Sambhu', role: 'Pickling anchor — flexes',      inactive: false },
  // Off-roll. Kept for historical attendance; excluded via DEF_CFG.excludedIds.
  { id: 'rounak',        name: 'Rounak', role: 'Data Admin',     inactive: true },
];

// Contract daily-hands — paid per hour at the contract rate (DEF_CFG.hourRate,
// which arrives through the roster import).
export const DEF_CW = [
  { id: 'sripati',   name: 'Sripati',   inactive: false },
  { id: 'budheswar', name: 'Budheswer', inactive: false },
  { id: 'birsa',     name: 'Birsa',     inactive: false },
  { id: 'rocky',     name: 'Rocky',     inactive: false },
  { id: 'champai',   name: 'Champai',   inactive: false },
  { id: 'sai',       name: 'Sai',       inactive: false },
  { id: 'naren',     name: 'Naren',     inactive: false },
  { id: 'mantu',     name: 'Montu',     inactive: false },
  { id: 'rakesh',    name: 'Rakesh',    inactive: false },
  { id: 'vijay',     name: 'Vijay',     inactive: false },
  // Off the active pool.
  { id: 'kusu',      name: 'Kusu',      inactive: true },
  { id: 'tuklu',     name: 'Tuklu',     inactive: true },
];
