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
      projectIds: ['123456'],
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
