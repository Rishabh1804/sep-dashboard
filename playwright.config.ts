import { defineConfig, devices } from '@playwright/test';

// Some sandboxes ship a Chromium build that differs from the one this
// Playwright version expects, and downloading the matching build is disabled
// there. The SessionStart hook detects that case and points this at the browser
// that IS present. Unset everywhere else, where Playwright's own resolution is
// correct and should be left alone. Same pattern as sep-invoicing.
const chromiumPath = process.env.PW_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

const PORT = Number(process.env.SEP_TEST_PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}/sep-dashboard/`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Aurelius ruling 2026-04-24 (PR #3 merge review): `retries: 0` is the
  // correct floor for both sep-invoicing and sep-dashboard. With the
  // hermetic font-stub + local static server the actual network-flake
  // surface is near zero, so retries would only mask real regressions.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/e2e/_serve.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { SEP_TEST_PORT: String(PORT) },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
  ],
});
