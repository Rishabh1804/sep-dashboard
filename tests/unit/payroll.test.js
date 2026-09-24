import {
  calcDayWages, calcCWWeeklyPay, calcPermMonthlyPay, getAttKey, cwHourRate, permOtRate,
  monthlyOtRate, guardDayRate, guardHourRate, daysInMonthOf, usesPlainRate, dayRateOf,
} from '../../src/shared/utils/payroll.js';

// SYNTHETIC fixture. Every rate and id below is invented: this repo is public
// and ships no pay data (Director's sensitive-data rule, 24 Sep 2026). The real
// rate card lives in soma-internal and reaches a device through Settings →
// Import roster. What these tests pin is the RULES — the arithmetic — which
// hold whatever the figures are.
//   contract:  50/hr → 400 for an 8-hour day
//   perm OT:   min(daily, 484) ÷ 8 × 1.1 → cap 66.55/hr
//   plain:     monthly 7,200, 12-hour shift → 240/day and 20/hr in a 30-day month
const cfg = {
  hourRate: 50,
  snackRate: 20,
  permOtMultiplier: 1.1,
  permOtBaseRate: 484,
  standardShift: { hours: 8 },
};

describe('getAttKey', () => {
  test('replaces hyphens with underscores in date', () => {
    expect(getAttKey('cw', 'cw_a', '2026-04-28')).toBe('cw_a_2026_04_28');
  });
});

describe('calcDayWages', () => {
  test('returns 0 when no one is present', () => {
    const total = calcDayWages({
      date: '2026-04-28', cfg,
      cwAtt: {}, peAtt: {},
      activeCW: [{ id: 'cw_a', name: 'A' }],
      activePermProd: [],
      guards: [],
    });
    expect(total).toBe(0);
  });

  test('CW present with 8h standard pays 8 × hourRate', () => {
    const cwAtt = { cw_a_2026_04_28: { status: 'P', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt, peAtt: {},
      activeCW: [{ id: 'cw_a', name: 'A' }],
      activePermProd: [], guards: [],
    });
    expect(total).toBe(400);
  });

  test('a rate override, if one is configured, beats the global', () => {
    const cwAtt = { cw_b_2026_04_28: { status: 'P', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28',
      cfg: { ...cfg, hourRateOverrides: { cw_b: 45 } },
      cwAtt, peAtt: {},
      activeCW: [{ id: 'cw_b', name: 'B' }],
      activePermProd: [], guards: [],
    });
    expect(total).toBe(360);          // 8 × 45
    expect(cwHourRate(cfg, 'cw_b')).toBe(50);
  });

  test('cwHourRate tolerates a junk or missing map, and a rate not yet imported', () => {
    expect(cwHourRate({ hourRate: 50 }, 'cw_b')).toBe(50);
    expect(cwHourRate({ hourRate: 50, hourRateOverrides: { cw_b: 'oops' } }, 'cw_b')).toBe(0);
    // Fresh install: no roster imported, hourRate is null → 0, never NaN.
    expect(cwHourRate({ hourRate: null }, 'cw_b')).toBe(0);
  });

  test('Perm worker contributes their dailyRate', () => {
    const peAtt = { pe_a_2026_04_28: { status: 'P', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt: {}, peAtt,
      activeCW: [],
      activePermProd: [{ id: 'pe_a', name: 'A', dailyRate: 484 }],
      guards: [],
    });
    expect(total).toBe(484);
  });

  test('a perm worker with no imported rate contributes 0, never NaN', () => {
    const peAtt = { pe_a_2026_04_28: { status: 'P', otHours: 2 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt: {}, peAtt,
      activeCW: [], activePermProd: [{ id: 'pe_a', name: 'A' }], guards: [],
    });
    expect(total).toBe(0);
    expect(dayRateOf({})).toBe(0);
    expect(dayRateOf({ dailyRate: 'x' })).toBe(0);
    expect(dayRateOf({ dailyRate: -5 })).toBe(0);
  });

  test('Absent worker contributes nothing', () => {
    const peAtt = { pe_a_2026_04_28: { status: 'A', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt: {}, peAtt,
      activeCW: [], activePermProd: [{ id: 'pe_a', name: 'A', dailyRate: 484 }],
      guards: [],
    });
    expect(total).toBe(0);
  });

  test('Guard with no monthly wage pays dailyRate when present', () => {
    const peAtt = { guard_a_2026_04_28: { status: 'P' } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt: {}, peAtt,
      activeCW: [], activePermProd: [],
      guards: [{ id: 'guard_a', name: 'G', dailyRate: 360 }],
    });
    expect(total).toBe(360);
  });
});

describe('calcCWWeeklyPay', () => {
  test('aggregates Mon-Sat hours and computes net = wage - advance', () => {
    const sat = '2026-05-09';
    const cwAtt = {};
    ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'].forEach((ds) => {
      cwAtt[`cw_a_${ds.replace(/-/g, '_')}`] = { status: 'P', otHours: 0 };
    });
    const result = calcCWWeeklyPay({
      satDate: sat, cfg,
      cwAtt,
      // The advKey uses the literal satDate with hyphens (no underscore swap).
      cwAdv: { 'cw_a_2026-05-09': 100 },
      prodLogs: {}, permSnacks: [],
      activeCW: [{ id: 'cw_a', name: 'A' }],
    });
    const w = result.workers[0];
    expect(w.days).toBe(5);
    expect(w.wage).toBe(5 * 400);
    expect(w.advance).toBe(100);
    expect(w.net).toBe(5 * 400 - 100);
  });
});

describe('calcPermMonthlyPay', () => {
  test('produces month YYYY-MM and zero workers when nobody is present', () => {
    const result = calcPermMonthlyPay({
      date: '2026-04-15', today: '2026-04-15', cfg,
      peAtt: {}, peAdv: {},
      activePermProd: [{ id: 'pe_a', name: 'A', dailyRate: 484 }],
      guards: [],
    });
    expect(result.month).toBe('2026-04');
    expect(result.workers[0].days).toBe(0);
    expect(result.workers[0].total).toBe(0);
  });
});


// ── Permanent-tier OT — the rule (BM, 23 Sep 2026; recorded in soma-internal) ─
// OT/hr = min(dailyRate, cap) ÷ 8 × multiplier. Below the cap, the multiplier ×
// the worker's own hourly rate; at or above it, the cap binds.
describe('permOtRate', () => {
  test('monthlyOtRate routes a guard to the plain hourly rate, never this rule', () => {
    const g = { id: 'guard_a', monthlyWage: 7200, shiftHours: 12 };
    const c = { ...cfg, guardIds: ['guard_a'] };
    expect(monthlyOtRate(c, g, '2026-09-07')).toBeCloseTo(20, 10);
    expect(monthlyOtRate(c, { id: 'x', dailyRate: 400 }, '2026-09-07')).toBeCloseTo(55, 10);
  });

  test('a non-numeric cap or multiplier yields 0, never NaN pay', () => {
    expect(permOtRate({ ...cfg, permOtBaseRate: 'x' }, { dailyRate: 400 })).toBe(0);
    expect(permOtRate({ ...cfg, permOtMultiplier: undefined }, { dailyRate: 400 })).toBe(0);
    // A fresh install holds a null cap until the roster is imported.
    expect(permOtRate({ ...cfg, permOtBaseRate: null }, { dailyRate: 400 })).toBe(0);
  });

  test('below the cap: multiplier × his own hourly rate', () => {
    expect(permOtRate(cfg, { dailyRate: 400 })).toBeCloseTo(55, 10);
    expect(permOtRate(cfg, { dailyRate: 410 })).toBeCloseTo(56.375, 10);
  });

  test('above the cap: the cap binds (600/day would be 82.50 uncapped)', () => {
    expect(permOtRate(cfg, { dailyRate: 600 })).toBeCloseTo(66.55, 10);
    expect(permOtRate(cfg, { dailyRate: 500 })).toBeCloseTo(66.55, 10);
  });

  test('continuous at exactly the cap, and strictly below just under it', () => {
    expect(permOtRate(cfg, { dailyRate: 484 })).toBeCloseTo(66.55, 10);
    expect(permOtRate(cfg, { dailyRate: 483 })).toBeLessThan(66.55);
  });

  test('the RATE is not floored to whole rupees', () => {
    expect(permOtRate(cfg, { dailyRate: 600 })).not.toBe(66);
    expect(permOtRate(cfg, { dailyRate: 410 })).not.toBe(56);
  });

  test('a missing or junk daily rate gives 0 — a visible zero, never a silently capped payment', () => {
    expect(permOtRate(cfg, {})).toBe(0);
    expect(permOtRate(cfg, { dailyRate: 'x' })).toBe(0);
    expect(permOtRate(cfg, { dailyRate: -10 })).toBe(0);
  });
});

describe('perm OT through the payroll functions — the paid AMOUNT is floored, the rate is not', () => {
  const below = { id: 'pe_below', name: 'Below', dailyRate: 410 };
  const above = { id: 'pe_above', name: 'Above', dailyRate: 600 };
  const date = '2026-09-07';

  test('calcDayWages — below cap, 3 OT hr: 410 + floor(3 × 56.375 = 169.125) = 579', () => {
    const total = calcDayWages({
      date, cfg, cwAtt: {}, activeCW: [], guards: [],
      peAtt: { [getAttKey('perm', 'pe_below', date)]: { status: 'P', otHours: 3 } },
      activePermProd: [below],
    });
    expect(total).toBe(579);
  });

  test('calcDayWages — capped, 5 OT hr: floor(5 × 66.55 = 332.75) = 332, where a floored 66 rate pays 330', () => {
    const total = calcDayWages({
      date, cfg, cwAtt: {}, activeCW: [], guards: [],
      peAtt: { [getAttKey('perm', 'pe_above', date)]: { status: 'P', otHours: 5 } },
      activePermProd: [above],
    });
    expect(total).toBe(600 + 332);
  });

  test('calcPermMonthlyPay — below cap, 4 OT hr on one day: otPay = floor(4 × 56.375 = 225.5) = 225', () => {
    const rows = calcPermMonthlyPay({
      date, today: date, cfg, peAdv: {}, guards: [],
      peAtt: { [getAttKey('perm', 'pe_below', date)]: { status: 'P', otHours: 4 } },
      activePermProd: [below],
    });
    const r = rows.workers.find((x) => x.id === 'pe_below');
    expect(r.otPay).toBe(225);
    expect(r.otH).toBe(4);
  });
});

// BM, 23 Sep 2026: OT is computed PER MONTH — the month's hours × rate, floored
// once. A per-day floor on a fractional rate loses up to a rupee per OT day.
describe('perm OT is rounded once per month, not per day', () => {
  const month = (id, rate, daysWithOT, hrs) => {
    const peAtt = {};
    for (let d = 1; d <= daysWithOT; d++) {
      peAtt[getAttKey('perm', id, `2026-09-${String(d).padStart(2, '0')}`)] = { status: 'P', otHours: hrs };
    }
    return calcPermMonthlyPay({
      date: '2026-09-15', today: '2026-09-30', cfg, peAtt, peAdv: {},
      activePermProd: [{ id, name: id, dailyRate: rate }], guards: [],
    }).workers[0];
  };

  test('below cap, 3 OT hr on 10 days: floor(30 × 56.375 = 1,691.25) = 1,691 — a per-day floor paid 1,690', () => {
    const r = month('pe_below', 410, 10, 3);
    expect(r.otH).toBe(30);
    expect(r.otPay).toBe(1691);
  });

  test('capped, 3 OT hr on 10 days: floor(30 × 66.55 = 1,996.5) = 1,996 — a per-day floor paid 1,990', () => {
    expect(month('pe_above', 600, 10, 3).otPay).toBe(1996);
  });
});



// ── The plain monthly model — guards (BM, 14 + 23 + 24 Sep 2026) ──────────────
// Day rate = monthlyWage ÷ days in the month; hourly = day rate ÷ shiftHours,
// no multiplier. A worker with no monthlyWage falls back to his dailyRate.
describe('guard rates', () => {
  const g = { id: 'guard_a', monthlyWage: 7200, shiftHours: 12 };

  test('daysInMonthOf reads the calendar, leap year included', () => {
    expect(daysInMonthOf('2026-09-30')).toBe(30);
    expect(daysInMonthOf('2026-10-01')).toBe(31);
    expect(daysInMonthOf('2027-02-14')).toBe(28);
    expect(daysInMonthOf('2028-02-14')).toBe(29);
  });

  test('the day and hour rates follow the month and are exact, not floored', () => {
    expect(guardDayRate(g, '2026-09-07')).toBeCloseTo(240, 10);
    expect(guardHourRate(g, '2026-09-07')).toBeCloseTo(20, 10);
    expect(guardDayRate(g, '2026-10-07')).toBeCloseTo(7200 / 31, 10);
    expect(guardHourRate(g, '2026-10-07')).toBeCloseTo(7200 / 31 / 12, 10);
    expect(guardHourRate(g, '2027-02-10')).toBeCloseTo(7200 / 28 / 12, 10);
  });

  test('no monthlyWage → dailyRate; no shiftHours → 12', () => {
    expect(guardDayRate({ dailyRate: 360 }, '2026-10-07')).toBe(360);
    expect(guardHourRate({ dailyRate: 360 }, '2026-10-07')).toBe(30);
    expect(guardDayRate({ dailyRate: 'x' }, '2026-10-07')).toBe(0);
    expect(guardDayRate({}, '2026-10-07')).toBe(0);
    expect(guardHourRate({ monthlyWage: 7200, shiftHours: 0 }, '2026-09-07')).toBeCloseTo(20, 10);
  });

  test('a plain day pays the month\'s day rate; hours beyond the shift at the plain hourly rate', () => {
    const c = { ...cfg, guardIds: ['guard_a'] };
    const day = (ds, rec) => calcDayWages({
      date: ds, cfg: c, cwAtt: {}, activeCW: [], activePermProd: [], guards: [g],
      peAtt: { [getAttKey('perm', 'guard_a', ds)]: rec },
    });
    expect(day('2026-09-07', { status: 'P' })).toBe(240);
    expect(day('2026-10-07', { status: 'P' })).toBe(232);           // floor(232.26): a cost view
    expect(day('2026-09-07', { status: 'P', otHours: 2 })).toBe(280);
    expect(permOtRate(c, g)).toBe(0);                                 // never the 1.1× rule
  });

  test('calcPermMonthlyPay floors the month once: 28 days of a 31-day month', () => {
    const c = { ...cfg, guardIds: ['guard_a'] };
    const peAtt = {};
    for (let d = 1; d <= 28; d++) peAtt[getAttKey('perm', 'guard_a', `2026-08-${String(d).padStart(2, '0')}`)] = { status: 'P' };
    const r = calcPermMonthlyPay({
      date: '2026-08-15', today: '2026-08-31', cfg: c, peAdv: {}, peAtt,
      activePermProd: [], guards: [g],
    }).workers[0];
    expect(r.days).toBe(28);
    expect(r.basePay).toBe(Math.floor(28 * 7200 / 31));   // 6,503 — not 28 × floor(232.26) = 6,496
  });
});

// ── The plain monthly model as an option for non-floor staff — BM, 24 Sep ───
// Any worker carrying payModel 'monthly-plain' is priced like the guard:
// monthly wage ÷ days ÷ shift hours, no multiplier, never through permOtRate.
describe('payModel monthly-plain (non-floor option)', () => {
  const office = { id: 'office_x', name: 'Office', monthlyWage: 12000, shiftHours: 8, payModel: 'monthly-plain' };
  const c = { ...cfg, guardIds: ['guard_a'] };

  test('usesPlainRate: guards by id, and anyone carrying the option', () => {
    expect(usesPlainRate(c, { id: 'guard_a' })).toBe(true);
    expect(usesPlainRate(c, office)).toBe(true);
    expect(usesPlainRate(c, { id: 'pe_a', dailyRate: 360 })).toBe(false);
  });

  test('permOtRate refuses it; monthlyOtRate gives the plain rate (12000 ÷ 30 ÷ 8 = 50.00)', () => {
    expect(permOtRate(c, office)).toBe(0);
    expect(monthlyOtRate(c, office, '2026-09-07')).toBeCloseTo(50, 10);
    expect(monthlyOtRate(c, office, '2026-10-07')).toBeCloseTo(12000 / 31 / 8, 10);
  });

  test('calcPermMonthlyPay prices an option-carrier on the plain model even in the production list', () => {
    const peAtt = {};
    for (let d = 1; d <= 3; d++) peAtt[`office_x_2026_09_0${d}`] = { status: 'P', otHours: 2 };
    const { workers } = calcPermMonthlyPay({
      date: '2026-09-07', today: '2026-09-30', cfg: c, peAdv: {}, peAtt,
      activePermProd: [office], guards: [],
    });
    expect(workers[0].basePay).toBe(1200);   // 3 × 400.00
    expect(workers[0].otPay).toBe(300);      // 6 h × 50.00, no multiplier
  });

  test('calcDayWages prices it on the plain model from either list', () => {
    const peAtt = { office_x_2026_10_07: { status: 'P', otHours: 2 } };
    const day = Math.floor(12000 / 31); const ot = Math.floor(2 * 12000 / 31 / 8);
    const base = { date: '2026-10-07', cfg: c, cwAtt: {}, activeCW: [], peAtt };
    expect(calcDayWages({ ...base, activePermProd: [office], guards: [] })).toBe(day + ot);
    expect(calcDayWages({ ...base, activePermProd: [], guards: [office] })).toBe(day + ot);
  });
});
