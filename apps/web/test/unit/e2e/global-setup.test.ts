import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalSetup from '../../../test/e2e/global-setup';
import type { FullConfig } from '@playwright/test';
import { seedE2EBaseline } from '@/db/seed/seed-e2e-baseline';

vi.mock('@/db/seed/seed-e2e-baseline', () => ({
  seedE2EBaseline: vi.fn().mockResolvedValue(undefined),
}));

const originalFetch = globalThis.fetch;
const originalCi = process.env.CI;
const originalDatabaseUrl = process.env.DATABASE_URL;

function createConfig(baseURL = 'http://localhost:3000') {
  return {
    projects: [
      {
        use: {
          baseURL,
        },
      },
    ],
  } as FullConfig;
}

describe('web E2E global setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
    } as Response);
  });

  afterEach(() => {
    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it.each([
    { ci: 'true', label: 'CI' },
    { ci: undefined, label: 'local' },
  ])('does not load env files in $label', async ({ ci }) => {
    if (ci === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ci;
    }
    process.env.DATABASE_URL = 'postgres://runner.example/e2e';

    const loadEnvFile = vi
      .spyOn(process, 'loadEnvFile')
      .mockImplementation(() => undefined);

    await globalSetup(createConfig());

    expect(loadEnvFile).not.toHaveBeenCalled();
    expect(seedE2EBaseline).toHaveBeenCalledWith({
      databaseUrl: 'postgres://runner.example/e2e',
    });
  });

  it('passes the runner database URL into the baseline seed', async () => {
    process.env.DATABASE_URL = 'postgres://runner.example/e2e';

    await globalSetup(createConfig());

    expect(seedE2EBaseline).toHaveBeenCalledWith({
      databaseUrl: 'postgres://runner.example/e2e',
    });
  });
});
