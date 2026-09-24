// Wage and shift defaults: the pay RULES, which are code, not the pay DATA.
//
// Every rupee figure — the contract hourly rate, the permanent-tier OT cap, the
// snack rate — arrives at runtime through Settings → Import roster, from a file
// soma-internal generates (Director's sensitive-data rule, 24 Sep 2026). They
// ship as null here; a device keeps the values it already holds (seed-sync
// never overwrites them) and an import replaces them. A null rate prices as
// zero and Settings says the roster has not been imported, so a missing import
// is visible rather than silently wrong.
//
// The rules themselves:
//   · contract hand: every hour at hourRate (cwHourRate; hourRateOverrides is
//     the per-worker exception mechanism, empty by design);
//   · permanent tier: OT/hr = min(dailyRate, permOtBaseRate) ÷ 8 × permOtMultiplier;
//   · non-floor staff on the plain model (guards, and any worker carrying
//     payModel 'monthly-plain'): monthly wage ÷ days ÷ shiftHours, no multiplier.
// Their history and the rulings behind them are in soma-internal.
export const RATE_CFG_FIELDS = ['hourRate', 'permOtBaseRate', 'snackRate'];

export const DEF_CFG = {
  hourRate: null,          // ← roster import
  // worker id → an hourly rate that is NOT the contract-hand rate. Empty.
  hourRateOverrides: {},
  snackRate: null,         // ← roster import
  permOtMultiplier: 1.1,
  permOtBaseRate: null,    // ← roster import (the OT cap)
  // Guards: not on the production roster; their shift is their standard day.
  guardIds: ['uday'],
  excludedIds: ['rounak'],
  standardShift:      { start: '08:30', end: '17:00', hours: 8 },
  sundayHolidayShift: { start: '06:00', end: '14:00', hours: 8 },
  morningOT:          { start: '06:00', end: '08:30', hours: 3 },
  eveningOT:          { start: '17:00', end: '20:00', hours: 3 },
};
