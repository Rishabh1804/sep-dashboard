import { monthOf, monthDates } from '../../src/shared/utils/month.js';

describe('monthOf', () => {
  test('slices YYYY-MM from YYYY-MM-DD', () => {
    expect(monthOf('2026-04-28')).toBe('2026-04');
  });
});

describe('monthDates', () => {
  test('produces 30 days for April', () => {
    const arr = monthDates('2026-04');
    expect(arr).toHaveLength(30);
    expect(arr[0]).toBe('2026-04-01');
    expect(arr[29]).toBe('2026-04-30');
  });
  test('produces 28 days for non-leap February', () => {
    expect(monthDates('2026-02')).toHaveLength(28);
  });
  test('produces 29 days for leap February', () => {
    expect(monthDates('2024-02')).toHaveLength(29);
  });
});
