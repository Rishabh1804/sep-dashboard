import { sepRound, formatCurrency } from '../../src/shared/utils/currency.js';

describe('sepRound', () => {
  test('floors fractional rupees (Build Rule 5)', () => {
    expect(sepRound(123.99)).toBe(123);
    expect(sepRound(0.01)).toBe(0);
    expect(sepRound(0.99)).toBe(0);
  });

  test('passes integers through', () => {
    expect(sepRound(496)).toBe(496);
  });

  test('coerces NaN/null/undefined to 0', () => {
    expect(sepRound(undefined)).toBe(0);
    expect(sepRound(null)).toBe(0);
    expect(sepRound('not-a-number')).toBe(0);
  });

  test('handles negatives by flooring (note: floor(-0.5) = -1)', () => {
    expect(sepRound(-0.1)).toBe(-1);
    expect(sepRound(-100)).toBe(-100);
  });
});

describe('formatCurrency', () => {
  test('produces ₹ prefix and en-IN grouping', () => {
    expect(formatCurrency(123456)).toBe('₹1,23,456');
    expect(formatCurrency(0)).toBe('₹0');
  });

  test('floors via sepRound before formatting', () => {
    expect(formatCurrency(99.99)).toBe('₹99');
  });
});
