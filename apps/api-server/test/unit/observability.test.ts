import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/node';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(
    (
      callback: (scope: {
        setTag: ReturnType<typeof vi.fn>;
        setContext: ReturnType<typeof vi.fn>;
      }) => void
    ) => {
      callback({
        setTag: vi.fn(),
        setContext: vi.fn(),
      });
    }
  ),
}));

describe('initObservability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Sentry only when DSN is configured', async () => {
    const { initObservability } =
      await import('../../src/lib/observability.js');

    initObservability({
      app: 'api-server',
      appEnv: 'production',
      dsn: 'https://example.ingest.sentry.io/789',
      release: 'sha-789',
    });

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://example.ingest.sentry.io/789',
        environment: 'production',
        release: 'sha-789',
      })
    );
  });
});

describe('captureServerError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures exceptions with request metadata', async () => {
    const { captureServerError } =
      await import('../../src/lib/observability.js');

    captureServerError(new Error('boom'), {
      requestId: 'req_123',
      route: '/hello',
    });

    expect(Sentry.withScope).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
