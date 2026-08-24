import { defineConfig, devices } from '@playwright/test';

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
      use: {
        ...devices['Desktop Chrome'],
        // Some sandboxes ship a Chromium build this Playwright version does not
        // expect and block downloading the matching one. PW_CHROMIUM_PATH points
        // at the one that IS present; unset everywhere else, so CI and local
        // runs keep using Playwright's own managed browser. Same escape hatch
        // sep-invoicing carries, for the same reason.
        ...(process.env.PW_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
});
