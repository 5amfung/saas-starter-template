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
});
