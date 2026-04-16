import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './test/e2e/global-setup.ts',
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Serve a pre-built E2E bundle (built by `build:e2e` script).
      // E2E_MOCK_EMAIL is inlined at build time — no runtime env needed.
      // Separating build from serve avoids EMFILE (too many open files)
      // errors caused by Rollup opening hundreds of source files inside
      // Playwright's process tree.
      command:
        'node --env-file=.env --import ./.output/server/instrument.server.mjs ./.output/server/index.mjs',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      env: {
        SENTRY_DISABLED: 'true',
        PORT: '3000',
        WORKSPACE_SECRET_ENCRYPTION_KEY:
          process.env.WORKSPACE_SECRET_ENCRYPTION_KEY ??
          'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      },
      stderr: 'pipe',
    },
    {
      command:
        'stripe listen --forward-to localhost:3000/api/auth/stripe/webhook',
      reuseExistingServer: !process.env.CI,
      stderr: 'pipe',
    },
  ],
});
