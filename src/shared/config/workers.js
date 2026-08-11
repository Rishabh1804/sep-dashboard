// Default rosters seeded into localStorage on first run (`initData`).
// Once persisted, edits via Settings flow through storage/workers.js.

export const DEF_PERM = [
  { id: 'shyam_bera',     name: 'Shyam',  role: 'Production Supervisor', dailyRate: 576, inactive: false },
  { id: 'sharat_mahato',  name: 'Sarat',  role: 'VAT A1 Lead',           dailyRate: 496, inactive: false },
  { id: 'sunil_mahato',   name: 'Sunil',  role: 'Barrel Lead',           dailyRate: 496, inactive: false },
  { id: 'rupa_bera',      name: 'Rupa',   role: 'VAT A2 Lead',           dailyRate: 496, inactive: false },
  { id: 'bp_sharma',      name: 'Bhanu',  role: 'Worker',                dailyRate: 496, inactive: false },
  // 'Lucky' was not an alias anyone uses. staff-aliases.md: Laxmi Kant Das —
  // Lakhi / Laxmi / LK. The register says Lakhi. HR-4 canonical-name discipline.
  { id: 'lk_das',         name: 'Lakhi',  role: 'Worker',                dailyRate: 496, inactive: false },
  { id: 'lal',            name: 'Lal',    role: 'Worker',                dailyRate: 496, inactive: false },
  { id: 'suklal',         name: 'Suklal', role: 'Pickling Lead',         dailyRate: 440, inactive: false },
  { id: 'uday',           name: 'Uday',   role: 'Guard',                 dailyRate: 360, inactive: false },
  { id: 'rounak',         name: 'Rounak', role: 'Data Admin',            dailyRate: 0,   inactive: true  },
];

// Reconciled 11 Aug 2026 against soma-internal `operations/staff-aliases.md`
// and the W32 register. Display names use the codex canonical spelling (HR-4);
// ids are frozen because stored attendance and sigma-baseline keys reference them.
// Two workers were missing entirely and two AWOL workers were being offered —
// twenty on the floor, twenty-one in config, the wrong twenty-one.
export const DEF_CW = [
  { id: 'sripati',   name: 'Sripati',   inactive: false },
  { id: 'naren',     name: 'Naren',     inactive: false },
  { id: 'champai',   name: 'Champai',   inactive: false },
  { id: 'budheswar', name: 'Buddheswar', inactive: false },
  { id: 'sai',       name: 'Sai',       inactive: false },
  { id: 'shambhu',   name: 'Sambhu',    inactive: false },
  { id: 'mantu',     name: 'Montu',     inactive: false },
  { id: 'rocky',     name: 'Rocky',     inactive: false },
  { id: 'birsa',     name: 'Birsa',     inactive: false },
  { id: 'rakesh',    name: 'Rakesh',    inactive: false },  // joined W22; on every payout since W29
  { id: 'vijay',     name: 'Vijay',     inactive: false },  // joined 14 Jul 2026; roster 19 -> 20
  // Kept as ids so historical attendance still resolves, flagged inactive so
  // neither is offered for assignment. Tuklu AWOL confirmed 18 May 2026;
  // Kusu off the active pool after 5+ consecutive absences (staff-aliases.md).
  { id: 'kusu',      name: 'Kusu',      inactive: true  },
  { id: 'tuklu',     name: 'Tuklu',     inactive: true  },
];
