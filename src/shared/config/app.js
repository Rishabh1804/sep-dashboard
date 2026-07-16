// App version reported in Settings → General. Bump when shipping.
export const APP_VERSION = '2.1.0-alpha.6';

// Numeric build counter, stamped on every Firestore write as
// app_version (string form, e.g. '1'). The rules' buildSupported()
// parses it with int() and compares against config/min_supported_build
// — NUMERIC compare per the 2026-06-10 hardening; a semver string here
// would fail int() and be denied (fail closed). Bump on every deploy.
export const BUILD = 3;
