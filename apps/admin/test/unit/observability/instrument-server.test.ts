import { describe, expect, it } from 'vitest';

describe('admin server Sentry runtime gate', () => {
  it('disables server Sentry when SENTRY_DISABLED is true', async () => {
    // @ts-expect-error test imports the JS bootstrap module directly
    const { isServerSentryEnabled } =
      await import('../../../instrument.server.mjs');

    expect(
      isServerSentryEnabled({
        NODE_ENV: 'production',
        SENTRY_DISABLED: 'true',
      })
    ).toBe(false);
  });

  it('enables server Sentry by default outside tests', async () => {
    // @ts-expect-error test imports the JS bootstrap module directly
    const { isServerSentryEnabled } =
      await import('../../../instrument.server.mjs');

    expect(
      isServerSentryEnabled({
        NODE_ENV: 'production',
      })
    ).toBe(true);
  });
});
