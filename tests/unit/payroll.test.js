import {
  calcDayWages, calcCWWeeklyPay, calcPermMonthlyPay, getAttKey, cwHourRate,
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
