// Playwright configuration for MyAct.
// CommonJS on purpose: package.json has no "type": "module", so
// `node --check playwright.config.js` validates this file as-is.

const { defineConfig, devices } = require('@playwright/test');

const PORT = 8777;
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  // The suite shares one isolated SQLite database, so keep it sequential.
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Cross-browser smoke: npx playwright install firefox
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      // WebKit is the closest automated proxy for Safari on Linux.
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    // Boot a throwaway server/database so tests never touch real user data.
    command:
      'MYACT_DB=.e2e/myact.db MYACT_DATA=.e2e MYACT_PORT=8777 python3 server.py',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
