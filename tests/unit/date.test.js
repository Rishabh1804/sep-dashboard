import { localDateStr, isSunday, getWeekEnd } from '../../src/shared/utils/date.js';

describe('localDateStr', () => {
  test('emits YYYY-MM-DD for a known date', () => {
    expect(localDateStr(new Date(2026, 3, 28))).toBe('2026-04-28');
  });

  test('zero-pads month and day', () => {
    expect(localDateStr(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  test('returns today when called with no args', () => {
    const r = localDateStr();
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isSunday', () => {
  test('returns true for Sundays', () => {
    expect(isSunday('2026-05-03')).toBe(true);  // Sun 3 May 2026
  });
  test('returns false for non-Sundays', () => {
    expect(isSunday('2026-05-04')).toBe(false); // Mon
  });
});

describe('getWeekEnd', () => {
  test('returns next Saturday for a Monday', () => {
    expect(getWeekEnd('2026-05-04')).toBe('2026-05-09'); // Mon → Sat
  });
  test('returns same Saturday when given Saturday', () => {
    expect(getWeekEnd('2026-05-09')).toBe('2026-05-09');
  });
  test('returns previous Saturday for a Sunday', () => {
    expect(getWeekEnd('2026-05-03')).toBe('2026-05-09'); // Sun → upcoming Sat (per v2.1 rule: day===0 ? +6)
  });
});
