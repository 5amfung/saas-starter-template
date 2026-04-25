import { describe, expect, it } from 'vitest';
import { isBrowserSentryRuntimeEnabled } from '@/observability/client';

describe('browser Sentry runtime gate', () => {
  it('enables browser Sentry by default outside tests', () => {
    expect(
      isBrowserSentryRuntimeEnabled({
        MODE: 'production',
        VITEST: false,
        VITE_SENTRY_DISABLED: 'false',
      })
    ).toBe(true);
  });

  it('disables browser Sentry when the runtime disable flag is set', () => {
    expect(
      isBrowserSentryRuntimeEnabled({
        MODE: 'production',
        VITEST: false,
        VITE_SENTRY_DISABLED: 'true',
      })
    ).toBe(false);
  });

  it('disables browser Sentry while running tests', () => {
    expect(
      isBrowserSentryRuntimeEnabled({
        MODE: 'test',
        VITEST: true,
        VITE_SENTRY_DISABLED: 'false',
      })
    ).toBe(false);
  });
});
