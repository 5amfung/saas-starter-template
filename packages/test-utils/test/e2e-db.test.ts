import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveE2EDatabaseUrl } from '../src/e2e-database-url';

const { existsSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}));

vi.mock('@/db/client', () => ({
  createDb: vi.fn(() => ({ db: 'fixture' })),
}));

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalCi = process.env.CI;

async function importE2EDb() {
  vi.resetModules();
  return import('../src/e2e-db');
}

describe('getE2EDb env resolution', () => {
  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCi;
    }

    existsSyncMock.mockReset();
    vi.restoreAllMocks();
  });

  it('uses DATABASE_URL from the CI environment without loading local env files', async () => {
    process.env.CI = 'true';
    process.env.DATABASE_URL = 'postgres://ci.example/e2e';
    existsSyncMock.mockReturnValue(false);
    const loadEnvFile = vi
      .spyOn(process, 'loadEnvFile')
      .mockImplementation(() => undefined);

    const { getE2EDb } = await importE2EDb();

    expect(getE2EDb()).toEqual({ db: 'fixture' });
    expect(loadEnvFile).not.toHaveBeenCalled();
  });

  it('fails fast in CI instead of falling back to local env files', async () => {
    process.env.CI = 'true';
    delete process.env.DATABASE_URL;
    existsSyncMock.mockReturnValue(false);
    const loadEnvFile = vi
      .spyOn(process, 'loadEnvFile')
      .mockImplementation(() => undefined);
    const { getE2EDb } = await importE2EDb();

    expect(() => getE2EDb()).toThrow(
      'DATABASE_URL is required for E2E DB helpers in CI.'
    );
    expect(loadEnvFile).not.toHaveBeenCalled();
  });

  it('loads apps/web/.env.local for local runner-side database access', () => {
    delete process.env.CI;
    delete process.env.DATABASE_URL;
    existsSyncMock.mockReturnValue(true);
    const loadEnvFile = vi
      .spyOn(process, 'loadEnvFile')
      .mockImplementation((path) => {
        expect(String(path)).toContain('apps/web/.env.local');
        process.env.DATABASE_URL = 'postgres://local.example/e2e';
      });

    expect(resolveE2EDatabaseUrl('seedE2EBaseline')).toBe(
      'postgres://local.example/e2e'
    );
    expect(loadEnvFile).toHaveBeenCalledOnce();
  });
});
