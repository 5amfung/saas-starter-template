import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

type DrizzleConfigWithCredentials = {
  dbCredentials?: {
    url?: string;
  };
};

async function importDrizzleConfig() {
  const module = await import('../../../drizzle.config.ts');
  return module.default as DrizzleConfigWithCredentials;
}

describe('Drizzle config environment loading', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.doUnmock('vite');
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('loads Vite env for local Drizzle commands when DATABASE_URL is missing', async () => {
    delete process.env.CI;
    delete process.env.DATABASE_URL;

    const loadEnv = vi.fn(() => ({
      DATABASE_URL: 'postgres://local.example/web',
    }));

    vi.doMock('vite', () => ({
      loadEnv,
    }));

    const config = await importDrizzleConfig();

    expect(loadEnv).toHaveBeenCalledWith('development', process.cwd(), '');
    expect(config.dbCredentials?.url).toBe('postgres://local.example/web');
  });

  it('loads Vite env for local Drizzle commands when DATABASE_URL is blank', async () => {
    delete process.env.CI;
    process.env.DATABASE_URL = '';

    const loadEnv = vi.fn(() => {
      expect(process.env.DATABASE_URL).toBeUndefined();
      return {
        DATABASE_URL: 'postgres://local.example/web',
      };
    });

    vi.doMock('vite', () => ({
      loadEnv,
    }));

    const config = await importDrizzleConfig();

    expect(loadEnv).toHaveBeenCalledWith('development', process.cwd(), '');
    expect(config.dbCredentials?.url).toBe('postgres://local.example/web');
  });

  it('uses DATABASE_URL from the process environment before local env files', async () => {
    delete process.env.CI;
    process.env.DATABASE_URL = 'postgres://process.example/web';

    const loadEnv = vi.fn(() => ({
      DATABASE_URL: 'postgres://local.example/web',
    }));

    vi.doMock('vite', () => ({
      loadEnv,
    }));

    const config = await importDrizzleConfig();

    expect(loadEnv).not.toHaveBeenCalled();
    expect(config.dbCredentials?.url).toBe('postgres://process.example/web');
  });

  it('does not load local env files in CI', async () => {
    process.env.CI = 'true';
    delete process.env.DATABASE_URL;

    const loadEnv = vi.fn(() => ({
      DATABASE_URL: 'postgres://local.example/web',
    }));

    vi.doMock('vite', () => ({
      loadEnv,
    }));

    const config = await importDrizzleConfig();

    expect(loadEnv).not.toHaveBeenCalled();
    expect(config.dbCredentials?.url).toBeUndefined();
  });

  it('loads production-mode Vite env when NODE_ENV is production', async () => {
    delete process.env.CI;
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'production';

    const loadEnv = vi.fn(() => ({
      DATABASE_URL: 'postgres://production.example/web',
    }));

    vi.doMock('vite', () => ({
      loadEnv,
    }));

    const config = await importDrizzleConfig();

    expect(loadEnv).toHaveBeenCalledWith('production', process.cwd(), '');
    expect(config.dbCredentials?.url).toBe('postgres://production.example/web');
  });
});
