import { getBrowserSentryTunnel } from '@/observability/client';

describe('browser Sentry tunnel config', () => {
  it('uses the app tunnel route when browser Sentry is configured', () => {
    expect(
      getBrowserSentryTunnel({
        VITE_SENTRY_DSN: 'https://public@example.ingest.sentry.io/123456',
      })
    ).toBe('/api/tunnel');
  });

  it('does not set a tunnel when the browser DSN is missing', () => {
    expect(getBrowserSentryTunnel({})).toBeUndefined();
  });
});
