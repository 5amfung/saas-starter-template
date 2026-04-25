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
});
