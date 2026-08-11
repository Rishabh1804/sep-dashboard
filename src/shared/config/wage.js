// Wage and shift defaults. CW are paid hourly (`hourRate`); Perm OT is
// pro-rated on `permOtBaseRate` × `permOtMultiplier` regardless of the
// worker's normal daily rate, by Sovereign convention.

export const DEF_CFG = {
  // 47.50, not 41.25. soma-internal tasks.md:27 — "T-CJ (Champai rate):
  // Rs 380/day confirmed (= Rs 47.50/hr; NOT Rs 41.25) … T-CJ resolved."
  // The 11-Jun EXTRA ruling also pays the pool at a flat Rs 47.50/hr. 41.25 was
  // a de-facto rate superseded 4 May 2026 and left here, making every EXTRA
  // rupee this app computed 13% low. Corrected 11 Aug 2026; pinned by test.
  hourRate: 47.50,
  snackRate: 20,
  permOtMultiplier: 1.1,
  permOtBaseRate: 496,
  guardIds: ['uday'],
  excludedIds: ['rounak'],
  standardShift:      { start: '08:30', end: '17:00', hours: 8 },
  sundayHolidayShift: { start: '06:00', end: '14:00', hours: 8 },
  morningOT:          { start: '06:00', end: '08:30', hours: 3 },
  // 17:00-24:00 = 7 h (BM, 11 Aug). Was 20:00 / 3 h, which made the production
  // tab render "Evening OT 17:00-20:00 (3h)" while recalcExtra booked the
  // deficit at 7 — the operator shown two different evening blocks on one
  // screen (Castor MEDIUM-4). Mirrors BLOCK_HOURS.eveningOT; keep in step.
  // NOTE: shadowed on existing installs — initData seeded the whole DEF_CFG
  // into K.prodCfg in May, so saved values win. See migrations.js.
  eveningOT:          { start: '17:00', end: '24:00', hours: 7 },
};
