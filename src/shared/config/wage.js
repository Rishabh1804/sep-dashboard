// Wage and shift defaults. CW are paid hourly (`hourRate`); Perm OT is
// pro-rated on `permOtBaseRate` × `permOtMultiplier` regardless of the
// worker's normal daily rate, by Sovereign convention.

export const DEF_CFG = {
  hourRate: 41.25,
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
