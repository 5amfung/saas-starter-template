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
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'node --env-file=.env --import ./.output/server/instrument.server.mjs ./.output/server/index.mjs',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    env: {
      SENTRY_DISABLED: 'true',
      PORT: '3001',
      WORKSPACE_SECRET_ENCRYPTION_KEY:
        process.env.WORKSPACE_SECRET_ENCRYPTION_KEY ??
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    },
    stderr: 'pipe',
  },
});
