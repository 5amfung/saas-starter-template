import { describe, expect, it } from 'vitest';

describe('web server Sentry runtime gate', () => {
  it('disables server Sentry when VITE_SENTRY_DISABLED is true', async () => {
    const { isServerSentryEnabled } = await import(
      // @ts-ignore test imports the JS bootstrap module directly
      '../../../instrument.server.mjs'
    );

    expect(
      isServerSentryEnabled({
        NODE_ENV: 'production',
        VITE_SENTRY_DISABLED: 'true',
      })
    ).toBe(false);
  });

  it('enables server Sentry by default outside tests', async () => {
    const { isServerSentryEnabled } = await import(
      // @ts-ignore test imports the JS bootstrap module directly
      '../../../instrument.server.mjs'
    );

    expect(
      isServerSentryEnabled({
        NODE_ENV: 'production',
      })
    ).toBe(true);
  });

  it('uses Vercel server runtime environment variables when available', async () => {
    const { getServerSentryDsn, getServerSentryEnvironment } = await import(
      // @ts-ignore test imports the JS bootstrap module directly
      '../../../instrument.server.mjs'
    );

    expect(
      getServerSentryDsn({
        SENTRY_DSN: 'server-dsn',
        VITE_SENTRY_DSN: 'browser-dsn',
      })
    ).toBe('server-dsn');
    expect(
      getServerSentryEnvironment({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      })
    ).toBe('preview');
  });

  it('derives server trace propagation targets from runtime origins', async () => {
    const { getServerTracePropagationTargets } = await import(
      // @ts-ignore test imports the JS bootstrap module directly
      '../../../instrument.server.mjs'
    );

    const targets = getServerTracePropagationTargets({
      BETTER_AUTH_URL: 'https://app.example.com/',
      VERCEL_URL: 'preview.example.vercel.app',
      VERCEL_BRANCH_URL: 'branch.example.vercel.app',
    });

    expect(targets[0]).toBe('localhost');
    expect(targets[1]).toEqual(/^\/api\//);
    expect(targets).toContain('https://app.example.com');
    expect(targets).toContain('https://preview.example.vercel.app');
    expect(targets).toContain('https://branch.example.vercel.app');
  });

  it('deduplicates and ignores invalid server trace origins', async () => {
    const { getServerTracePropagationTargets } = await import(
      // @ts-ignore test imports the JS bootstrap module directly
      '../../../instrument.server.mjs'
    );

    expect(
      getServerTracePropagationTargets({
        BETTER_AUTH_URL: 'https://app.example.com/auth',
        VERCEL_URL: 'app.example.com',
        VERCEL_BRANCH_URL: 'not a valid origin',
      })
    ).toEqual(['localhost', /^\/api\//, 'https://app.example.com']);
  });
});
