// Default rosters seeded into localStorage on first run (`initData`).
// Once persisted, edits via Settings flow through storage/workers.js.
//
// ── SOURCE OF TRUTH ─────────────────────────────────────────────────────────
// The roster and the rate card live in the soma-internal codex, not here:
//   · names + tiers → `operations/staff-aliases.md` (canonical name resolution)
//   · rate card     → `decisions/2026-06-10.md` §1, effective 1 Apr 2026
//   · tier rules    → `frameworks/roles-responsibilities-v1.1.md`
// `operations/roster.md` is NOT the source — it carries a "STALE — rates &
// several statuses superseded 10 Jun 2026" banner at its own head, still lists
// Kusu/Tuklu/Ramo as active, and carries neither Rakesh nor Vijay.
//
// ── IDs ARE LOAD-BEARING. NEVER RENAME ONE. ─────────────────────────────────
// A worker id is a Firestore DOC PATH SEGMENT (`workers/{id}/shifts/...`, per
// transport.js) and the prefix of every localStorage attendance key
// (`getAttKey` → `{id}_2026_08_24`). Changing an id orphans that worker's
// entire shift subcollection in staging AND every historical attendance record
// on every device. So where the codex's canonical spelling differs from an id,
// the DISPLAY NAME moves and the id stays:
//   lk_das    → 'Lakhi'  (= Laxmi Kant Das; "Lucky" was a mis-transliteration)
//   bp_sharma → 'Bhanu'  (= Bhanu Pratap Sharma) — already correct
//   shambhu   → 'Sambhu' (codex canonical; "Shambhu" is Shyam's spelling)
//   mantu     → 'Montu'  (codex canonical; "Mantu" is a variant)
//
// ── ROSTER IS 20 ────────────────────────────────────────────────────────────
// 19 → 20 on 14 Jul 2026 when Vijay joined; every attendance file from
// 2026-W29 forward uses /20. Here that is 9 active perm/perm-contract rows
// plus 11 active daily hands. Verified against `attendance/2026-W33.md` day 1,
// whose own arithmetic is 15 on site + 5 weekly-absent = 20.
//
// Workers off the active pool are marked `inactive`, never deleted: the codex
// holds them as "administrative inactive — no formal non-renewal letter", and
// deleting a row would orphan the historical attendance keyed to its id.

export const DEF_PERM = [
  // Permanent — monthly salary. dailyRate per the ratified 1 Apr 2026 card.
  { id: 'shyam_bera',    name: 'Shyam',  role: 'Production Supervisor + Barrel Lead', dailyRate: 576, inactive: false },
  { id: 'sharat_mahato', name: 'Sarat',  role: 'VAT A1 Lead',    dailyRate: 500, inactive: false },
  { id: 'rupa_bera',     name: 'Rupa',   role: 'VAT A2 Lead',    dailyRate: 500, inactive: false },
  { id: 'sunil_mahato',  name: 'Sunil',  role: 'Barrel Floor',   dailyRate: 470, inactive: false },
  { id: 'suklal',        name: 'Suklal', role: 'Pickling Lead',  dailyRate: 440, inactive: false },
  { id: 'uday',          name: 'Uday',   role: 'Day Guard',      dailyRate: 300, inactive: false },

  // Permanent contract tier — job-work, monthly (= daily rate × 30), flex
  // VAT/Barrel, explicitly NOT pickling (roles-responsibilities-v1.1 §"Three
  // workers"). Same monthly-salary treatment here as the rows above; the tier
  // distinction lives in the codex, which is where comp decisions are made.
  { id: 'lk_das',        name: 'Lakhi',  role: 'Job Work — flex VAT / Barrel', dailyRate: 420, inactive: false },
  { id: 'bp_sharma',     name: 'Bhanu',  role: 'Job Work — flex VAT / Barrel', dailyRate: 410, inactive: false },
  { id: 'lal',           name: 'Lal',    role: 'Job Work — flex VAT / Barrel', dailyRate: 360, inactive: false },

  // Off-roll. Kept for historical attendance; excluded via DEF_CFG.excludedIds.
  { id: 'rounak',        name: 'Rounak', role: 'Data Admin',     dailyRate: 0,   inactive: true },
];

// Contract daily-hands — ₹380/day × days attended, ₹47.50/hr (DEF_CFG.hourRate).
// Champai is the one exception and his rate is DISPUTED — see wage.js. The
// payout evidence favours ₹47.50 (W33 slip line 9 foots 16 hr at 47.50 = ₹760,
// and W24 did the same), but T-CJ is formally open, so the app keeps computing
// him at the framework's ₹41.25 rather than resolving it by side effect.
export const DEF_CW = [
  { id: 'shambhu',   name: 'Sambhu',    inactive: false },
  { id: 'sripati',   name: 'Sripati',   inactive: false },
  // 'Budheswer' is the floor spelling and the join key: a census across
  // soma-internal `attendance/` returns Budheswer 131 · Buddheswar 0 ·
  // Budheshwar 2, and `attendance-register-data.json` keys Budheswer. (The
  // alias file's "Floor / attendance name" column says Buddheswar — that is
  // drift in the alias file, confirmed by Castor at the 21 Sep audit.)
  { id: 'budheswar', name: 'Budheswer', inactive: false },
  { id: 'birsa',     name: 'Birsa',     inactive: false },
  { id: 'rocky',     name: 'Rocky',     inactive: false },
  { id: 'champai',   name: 'Champai',   inactive: false },
  { id: 'sai',       name: 'Sai',       inactive: false },
  { id: 'naren',     name: 'Naren',     inactive: false },
  { id: 'mantu',     name: 'Montu',     inactive: false },
  // Joined after the original seed. Both evidenced contract-daily by their
  // presence on the weekly cash payout, which is itself the contract-tier
  // instrument (staff-aliases.md, Castor C-2 28 Jul).
  { id: 'rakesh',    name: 'Rakesh',    inactive: false },   // joined W22
  { id: 'vijay',     name: 'Vijay',     inactive: false },   // joined 14 Jul 2026

  // Off active pool (staff-aliases.md § "Workers off active pool").
  { id: 'kusu',      name: 'Kusu',      inactive: true },    // 0% W20, 5+ consecutive absences
  { id: 'tuklu',     name: 'Tuklu',     inactive: true },    // AWOL confirmed 18 May 2026
];
