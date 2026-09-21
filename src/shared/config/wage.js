// Wage and shift defaults. CW are paid hourly (`hourRate`); Perm OT is
// pro-rated on `permOtBaseRate` × `permOtMultiplier` regardless of the
// worker's normal daily rate, by Sovereign convention.
//
// ── hourRate: 41.25 → 47.50 (corrected) ─────────────────────────────────────
// ₹47.50/hr is the ratified CONTRACT DAILY-HAND rate and has been since
// **Mon 4 May 2026** — it is ₹380/day ÷ 8 at exactly 1.0×, and Shyam was
// informed of it from W20 (soma-internal `tasks.md` T-F; `operations/roster.md`
// "Contract OT rate: ₹47.50/hr — aligns with new ₹380 base at 1.0×";
// `frameworks/roles-responsibilities-v1.1.md` §"Four workers").
//
// ₹41.25/hr was never the floor rate. It is **Champai's office rate**, a
// deliberately separate line: *"Office (Champai) | 1 | Weekly hourly ₹41.25/hr
// (special status — not factory worker for license purposes)"*. Seeding it as
// the global `hourRate` applied one man's special rate to all eleven hands, so
// every contract wage this app computed ran ~13% under the ratified card.
//
// ⚠ CHAMPAI'S OWN RATE IS AN OPEN QUESTION, NOT A SETTLED 41.25. The W24
// weekly tally actually paid him at ₹47.50 — a ₹300/wk gap flagged as a
// DIVERGENCE (staff-aliases.md, Castor F-1, 13 Jun) and still open under
// T-CJ. The override below therefore holds him at the FRAMEWORK rate rather
// than sweeping him to 47.50: raising the global must not resolve an open
// comp question as a side effect. Delete the override once BM rules.
export const DEF_CFG = {
  hourRate: 47.50,
  // worker id → hourly rate that is NOT the contract-hand rate. Keep this
  // empty of anything the codex has actually settled.
  hourRateOverrides: { champai: 41.25 },
  snackRate: 20,
  permOtMultiplier: 1.1,
  permOtBaseRate: 496,
  guardIds: ['uday'],
  excludedIds: ['rounak'],
  standardShift:      { start: '08:30', end: '17:00', hours: 8 },
  sundayHolidayShift: { start: '06:00', end: '14:00', hours: 8 },
  morningOT:          { start: '06:00', end: '08:30', hours: 3 },
  eveningOT:          { start: '17:00', end: '20:00', hours: 3 },
};
