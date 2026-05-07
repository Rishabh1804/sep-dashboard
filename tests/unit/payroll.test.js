import {
  calcDayWages, calcCWWeeklyPay, calcPermMonthlyPay, getAttKey,
} from '../../src/shared/utils/payroll.js';

const cfg = {
  hourRate: 41.25,
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

  test('CW present with 8h standard pays floor(8 * 41.25) = 330', () => {
    const cwAtt = { kusu_2026_04_28: { status: 'P', otHours: 0 } };
    const total = calcDayWages({
      date: '2026-04-28', cfg, cwAtt, peAtt: {},
      activeCW: [{ id: 'kusu', name: 'Kusu' }],
      activePermProd: [], guards: [],
    });
    expect(total).toBe(330);
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
    expect(w.wage).toBe(5 * 330); // 5 days × floor(8*41.25)
    expect(w.advance).toBe(100);
    expect(w.net).toBe(5 * 330 - 100);
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
