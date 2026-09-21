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
// ✅ CHAMPAI IS ON ₹47.50 TOO — ruled by BM, 21 Sep 2026. This closes the F-1
// divergence that had been open since 13 Jun (`staff-aliases.md`: the framework
// said ₹41.25, the W24 and W33 payouts both actually paid ₹47.50). The payout
// was right and the framework line was stale, which is the same lesson as
// "price off the invoice line, not the master": the instrument that moves money
// beats the document that describes it. His override is therefore DELETED
// rather than updated — he is simply on the contract rate.
export const DEF_CFG = {
  hourRate: 47.50,
  // worker id → an hourly rate that is NOT the contract-hand rate.
  // EMPTY TODAY. Kept because the codex has a history of per-worker rate
  // exceptions (Champai's own, ruled out on 21 Sep, was the last one) and
  // because the alternative — a second flat global — is what produced the
  // 41.25 bug in the first place.
  hourRateOverrides: {},
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
