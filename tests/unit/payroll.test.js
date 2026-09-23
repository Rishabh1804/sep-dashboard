import {
  calcDayWages, calcCWWeeklyPay, calcPermMonthlyPay, getAttKey, cwHourRate, permOtRate,
} from '../../src/shared/utils/payroll.js';

// Fixture, not the shipped config — but it now carries the RATIFIED contract
// rate (47.50 = 380/day / 8, effective 4 May 2026) so the numbers in these
// assertions are recognisable as real pay. 41.25 was Champai's office-only
// rate; see config/wage.js.
const cfg = {
  hourRate: 47.5,
  snackRate: 20,
  permOtMultiplier: 1.1,
  permOtBaseRate: 496,
  standardShift: { hours: 8 },
};

describe('getAttKey', () => {
  test('replaces hyphens with underscores in date', () => {
    expect(getAttKey('cw', 'kusu', '2026-04-28')).toBe('kusu_2026_04_28');
  });
});

describe('calcDayWages', () => {
  test('returns 0 when no one is present', () => {
    const total = calcDayWages({
      date: '2026-04-28', cfg,
      cwAtt: {}, peAtt: {},
      activeCW: [{ id: 'kusu', name: 'Kusu' }],
      activePermProd: [],
      guards: [],
    });
    expect(total).toBe(0);
  });

  test('CW present with 8h standard pays 8 * 47.50 = 380 (the day rate)', () => {
    const cwAtt = { kusu_2026_04_28: { status: 'P', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt, peAtt: {},
      activeCW: [{ id: 'kusu', name: 'Kusu' }],
      activePermProd: [], guards: [],
    });
    expect(total).toBe(380);
  });

  test('a rate override, if one is configured, beats the global', () => {
    const cwAtt = { champai_2026_04_28: { status: 'P', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28',
      cfg: { ...cfg, hourRateOverrides: { champai: 41.25 } },
      cwAtt, peAtt: {},
      activeCW: [{ id: 'champai', name: 'Champai' }],
      activePermProd: [], guards: [],
    });
    expect(total).toBe(330);          // 8 * 41.25
    // No override ships today — Champai was ruled onto the contract rate on
    // 21 Sep 2026; this exercises the mechanism, not his rate.
    expect(cwHourRate(cfg, 'champai')).toBe(47.5);
  });

  test('Perm worker contributes their dailyRate', () => {
    const peAtt = { sharat_mahato_2026_04_28: { status: 'P', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt: {}, peAtt,
      activeCW: [],
      activePermProd: [{ id: 'sharat_mahato', name: 'Sharat', dailyRate: 496 }],
      guards: [],
    });
    expect(total).toBe(496);
  });

  test('Absent worker contributes nothing', () => {
    const peAtt = { sharat_mahato_2026_04_28: { status: 'A', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt: {}, peAtt,
      activeCW: [], activePermProd: [{ id: 'sharat_mahato', name: 'Sharat', dailyRate: 496 }],
      guards: [],
    });
    expect(total).toBe(0);
  });

  test('Guard pays dailyRate when present', () => {
    const peAtt = { uday_2026_04_28: { status: 'P' } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt: {}, peAtt,
      activeCW: [], activePermProd: [],
      guards: [{ id: 'uday', name: 'Uday', dailyRate: 360 }],
    });
    expect(total).toBe(360);
  });
});

describe('calcCWWeeklyPay', () => {
  test('aggregates Mon-Sat hours and computes net = wage - advance', () => {
    const sat = '2026-05-09';
    // Mark Kusu present 5 days at 8h each.
    const cwAtt = {};
    ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'].forEach((ds) => {
      cwAtt[`kusu_${ds.replace(/-/g, '_')}`] = { status: 'P', otHours: 0 };
    });
    const result = calcCWWeeklyPay({
      satDate: sat, cfg,
      cwAtt,
      // The advKey uses the literal satDate with hyphens (no underscore swap).
      cwAdv: { 'kusu_2026-05-09': 100 },
      prodLogs: {}, permSnacks: [],
      activeCW: [{ id: 'kusu', name: 'Kusu' }],
    });
    const w = result.workers[0];
    expect(w.days).toBe(5);
    expect(w.wage).toBe(5 * 380); // 5 days × 8h × Rs 47.50 = 5 × Rs 380/day
    expect(w.advance).toBe(100);
    expect(w.net).toBe(5 * 380 - 100);
  });
});

describe('calcPermMonthlyPay', () => {
  test('produces month YYYY-MM and zero workers when nobody is present', () => {
    const result = calcPermMonthlyPay({
      date: '2026-04-15', today: '2026-04-15', cfg,
      peAtt: {}, peAdv: {},
      activePermProd: [{ id: 'sharat_mahato', name: 'Sharat', dailyRate: 496 }],
      guards: [],
      guardIds: [],
    });
    expect(result.month).toBe('2026-04');
    expect(result.workers[0].days).toBe(0);
    expect(result.workers[0].total).toBe(0);
  });
});


// ── Permanent-tier OT — BM ruling, 23 Sep 2026 ─────────────────────────────
// OT/hr = min(dailyRate, 496) ÷ 8 × 1.1. Below ₹496/day, 1.1× the man's own
// hourly rate; at or above it, capped at ₹68.20. Before this ruling the perm OT
// path had NO assertion anywhere in this file — a change to it was invisible.
describe('permOtRate', () => {
  test('a guard id gets 0 even if a caller routes him in (BM, 23 Sep)', () => {
    expect(permOtRate({ ...cfg, guardIds: ['uday'] }, { id: 'uday', dailyRate: 300 })).toBe(0);
  });

  test('a non-numeric cap or multiplier yields 0, never NaN pay', () => {
    expect(permOtRate({ ...cfg, permOtBaseRate: 'x' }, { dailyRate: 380 })).toBe(0);
    expect(permOtRate({ ...cfg, permOtMultiplier: undefined }, { dailyRate: 380 })).toBe(0);
  });

  test('below the cap: 1.1× his own hourly rate — Sambhu ₹380 → ₹52.25 exactly', () => {
    expect(permOtRate(cfg, { dailyRate: 380 })).toBeCloseTo(52.25, 10);
  });

  test('above the cap: ₹68.20 — Shyam ₹576 would be ₹79.20 uncapped', () => {
    expect(permOtRate(cfg, { dailyRate: 576 })).toBeCloseTo(68.2, 10);
    expect(permOtRate(cfg, { dailyRate: 500 })).toBeCloseTo(68.2, 10);
  });

  test('continuous at exactly ₹496, and strictly below just under it', () => {
    expect(permOtRate(cfg, { dailyRate: 496 })).toBeCloseTo(68.2, 10);
    expect(permOtRate(cfg, { dailyRate: 495 })).toBeLessThan(68.2);
  });

  test('the RATE is not floored to rupees — the old code paid ₹68, and would have paid Sambhu ₹52', () => {
    expect(permOtRate(cfg, { dailyRate: 576 })).not.toBe(68);
    expect(permOtRate(cfg, { dailyRate: 380 })).not.toBe(52);
  });

  test('a missing or junk daily rate gives 0 — a visible zero, never a silently capped payment', () => {
    expect(permOtRate(cfg, {})).toBe(0);
    expect(permOtRate(cfg, { dailyRate: 'x' })).toBe(0);
    expect(permOtRate(cfg, { dailyRate: -10 })).toBe(0);
  });
});

describe('perm OT through the payroll functions — the paid AMOUNT is floored, the rate is not', () => {
  const sambhu = { id: 'shambhu', name: 'Sambhu', dailyRate: 380 };
  const shyam  = { id: 'shyam',   name: 'Shyam',  dailyRate: 576 };
  const date = '2026-09-07';

  test('calcDayWages — Sambhu, 3 OT hr: 380 + floor(3 × 52.25 = 156.75) = 536', () => {
    const total = calcDayWages({
      date, cfg, cwAtt: {}, activeCW: [], guards: [],
      peAtt: { [getAttKey('perm', 'shambhu', date)]: { status: 'P', otHours: 3 } },
      activePermProd: [sambhu],
    });
    expect(total).toBe(536);
  });

  test('calcDayWages — Shyam, 2 OT hr: 576 + floor(2 × 68.20 = 136.40) = 712 (the old flat ₹68 paid 712 too; 5 hr is the first whole hour where they part)', () => {
    const total = calcDayWages({
      date, cfg, cwAtt: {}, activeCW: [], guards: [],
      peAtt: { [getAttKey('perm', 'shyam', date)]: { status: 'P', otHours: 2 } },
      activePermProd: [shyam],
    });
    expect(total).toBe(712);
  });

  test('calcDayWages — Shyam, 5 OT hr: floor(5 × 68.20 = 341.0) = 341, where the old floored ₹68 rate paid 340', () => {
    const total = calcDayWages({
      date, cfg, cwAtt: {}, activeCW: [], guards: [],
      peAtt: { [getAttKey('perm', 'shyam', date)]: { status: 'P', otHours: 5 } },
      activePermProd: [shyam],
    });
    expect(total).toBe(576 + 341);
  });

  test('calcPermMonthlyPay — Sambhu, 4 OT hr on one day: otPay = floor(4 × 52.25) = 209', () => {
    const rows = calcPermMonthlyPay({
      date, today: date, cfg, peAdv: {}, guards: [], guardIds: [],
      peAtt: { [getAttKey('perm', 'shambhu', date)]: { status: 'P', otHours: 4 } },
      activePermProd: [sambhu],
    });
    const r = rows.workers.find((x) => x.id === 'shambhu');
    expect(r.otPay).toBe(209);
    expect(r.otH).toBe(4);
  });
});
