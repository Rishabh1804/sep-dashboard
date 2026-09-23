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
// 2026-W29 forward uses /20. Here that is 10 active perm/perm-contract rows
// plus 10 active daily hands — Sambhu moved to the monthly tier effective
// September 2026 (BM, 21 Sep), taking the split from 9 + 11 to 10 + 10.
// Verified against `attendance/2026-W33.md` day 1,
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
  // Uday: the BM ruled (soma-internal, 14 Sep 2026) ₹9,000/month with the day
  // rate = ₹9,000 ÷ days in the month (₹290.32 in a 31-day month). This app has
  // one fixed dailyRate per man, so 300 is the 30-day figure — an approximation
  // of his pay, and of his directed-work OT rate (₹41.25 here, ₹39.92 in a
  // 31-day month). His 7–7 gate shift is never OT (BM, 23 Sep).
  { id: 'uday',          name: 'Uday',   role: 'Day Guard',      dailyRate: 300, inactive: false },

  // Permanent contract tier — job-work, monthly (= daily rate × 30), flex
  // VAT/Barrel, explicitly NOT pickling (roles-responsibilities-v1.1 §"Three
  // workers"). Same monthly-salary treatment here as the rows above; the tier
  // distinction lives in the codex, which is where comp decisions are made.
  { id: 'lk_das',        name: 'Lakhi',  role: 'Job Work — flex VAT / Barrel', dailyRate: 420, inactive: false },
  { id: 'bp_sharma',     name: 'Bhanu',  role: 'Job Work — flex VAT / Barrel', dailyRate: 410, inactive: false },
  { id: 'lal',           name: 'Lal',    role: 'Job Work — flex VAT / Barrel', dailyRate: 360, inactive: false },

  // ⭐ MOVED TO PERMANENT, EFFECTIVE SEPTEMBER 2026 (BM, 21 Sep). Rs 380/day is
  // his EXISTING contract day rate (= Rs 47.50 x 8), so this is not a raise: he
  // gains the monthly tier's treatment — rest credit, Sundays paid, OT x1.1 —
  // rather than a higher rate. He is the plant's heaviest-worked hand (80-hour
  // weeks, the T-DV fatigue anchor), so the tier move is also what finally puts
  // his hours on an instrument the weekly cash payout does not govern.
  //
  // ⚠ RECOMPUTING A PRE-SEPTEMBER WEEK. His historical attendance is keyed
  // `shambhu_YYYY_MM_DD` under the CW map (`cwAtt`); the perm path uses the
  // same key string under `peAtt`. Since he is no longer in activeCW, a
  // re-run of an August weekly payout would total him at zero. Read August and
  // earlier from the codex's own payout files, not by recomputing here.
  //
  // Unlike the job-work trio, a permanent MONTHLY man may work pickling —
  // Suklal is Pickling Lead and permanent — so his area rosters are unaffected.
  { id: 'shambhu',       name: 'Sambhu', role: 'Pickling anchor — flexes',      dailyRate: 380, inactive: false },

  // Off-roll. Kept for historical attendance; excluded via DEF_CFG.excludedIds.
  { id: 'rounak',        name: 'Rounak', role: 'Data Admin',     dailyRate: 0,   inactive: true },
];

// Contract daily-hands — ₹380/day × days attended, ₹47.50/hr (DEF_CFG.hourRate),
// with no per-worker exceptions: Champai's ₹41.25 office line was ruled out by
// BM on 21 Sep in favour of the contract rate his payouts were already using.
export const DEF_CW = [
  // Sambhu moved to DEF_PERM in September 2026 — see his row there.
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
