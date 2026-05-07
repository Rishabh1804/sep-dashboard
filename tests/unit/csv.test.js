import { csvCell } from '../../src/shared/utils/csv.js';

describe('csvCell (RFC 4180)', () => {
  test('wraps in double quotes', () => {
    expect(csvCell('hello')).toBe('"hello"');
  });
  test('doubles internal double-quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  test('preserves commas and newlines inside quotes', () => {
    expect(csvCell('a,b\nc')).toBe('"a,b\nc"');
  });
  test('coerces null/undefined to empty', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
  test('stringifies numbers', () => {
    expect(csvCell(123)).toBe('"123"');
  });
});
