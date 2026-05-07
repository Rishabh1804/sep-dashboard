/** Jest config for Phase 2.0 unit tests.
 *
 * Targets Layer 1 utilities (currency, date, format, payroll, calc-prod).
 * Per Session 8 charter, unit tests run in <100ms; full suite in <1s.
 */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
};
