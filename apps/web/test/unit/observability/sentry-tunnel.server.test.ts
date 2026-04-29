import {
  buildSentryEnvelopeUrl,
  parseSentryDsn,
} from '@/observability/sentry-tunnel.server';

describe('Sentry tunnel helpers', () => {
  it('parses the host and project id from a Sentry DSN', () => {
    expect(
      parseSentryDsn('https://public@example.ingest.sentry.io/123456')
    ).toEqual({
      host: 'example.ingest.sentry.io',
      origin: 'https://example.ingest.sentry.io',
      pathPrefix: '',
      projectIds: ['123456'],
    });
  });

  it('parses the origin, path prefix, and project id from a self-hosted Sentry DSN', () => {
    expect(
      parseSentryDsn('https://public@self-hosted.example.com:8443/sentry/123')
    ).toEqual({
      host: 'self-hosted.example.com',
      origin: 'https://self-hosted.example.com:8443',
      pathPrefix: '/sentry',
      projectIds: ['123'],
    });
  });

  it('rejects a Sentry DSN without a project id', () => {
    expect(() =>
      parseSentryDsn('https://public@example.ingest.sentry.io/')
    ).toThrow('Sentry DSN must include a project id');
  });

  it('builds the upstream envelope URL after validating the envelope DSN', () => {
    const envelope = [
      JSON.stringify({
        dsn: 'https://public@example.ingest.sentry.io/123456',
      }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify({ event_id: 'event_1' }),
    ].join('\n');

    expect(
      buildSentryEnvelopeUrl({
        configuredDsn: 'https://public@example.ingest.sentry.io/123456',
        envelope,
      })
    ).toBe('https://example.ingest.sentry.io/api/123456/envelope/');
  });

  it('preserves the DSN origin and path prefix when building the upstream envelope URL', () => {
    const envelope = [
      JSON.stringify({
        dsn: 'https://public@self-hosted.example.com:8443/sentry/123',
      }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify({ event_id: 'event_1' }),
    ].join('\n');

    expect(
      buildSentryEnvelopeUrl({
        configuredDsn: 'https://public@self-hosted.example.com:8443/sentry/123',
        envelope,
      })
    ).toBe('https://self-hosted.example.com:8443/sentry/api/123/envelope/');
  });

  it('rejects envelopes for an unexpected Sentry path prefix', () => {
    const envelope = JSON.stringify({
      dsn: 'https://public@self-hosted.example.com:8443/other/123',
    });

    expect(() =>
      buildSentryEnvelopeUrl({
        configuredDsn: 'https://public@self-hosted.example.com:8443/sentry/123',
        envelope,
      })
    ).toThrow('Invalid Sentry path prefix: /other');
  });

  it('rejects envelopes for an unexpected Sentry host', () => {
    const envelope = JSON.stringify({
      dsn: 'https://public@other.ingest.sentry.io/123456',
    });

    expect(() =>
      buildSentryEnvelopeUrl({
        configuredDsn: 'https://public@example.ingest.sentry.io/123456',
        envelope,
      })
    ).toThrow('Invalid Sentry hostname: other.ingest.sentry.io');
  });

  it('rejects envelopes for an unexpected Sentry project id', () => {
    const envelope = JSON.stringify({
      dsn: 'https://public@example.ingest.sentry.io/999999',
    });

    expect(() =>
      buildSentryEnvelopeUrl({
        configuredDsn: 'https://public@example.ingest.sentry.io/123456',
        envelope,
      })
    ).toThrow('Invalid Sentry project id: 999999');
  });
});
