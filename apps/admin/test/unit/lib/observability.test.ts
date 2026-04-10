import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

describe('initObservability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Sentry only when DSN is configured', async () => {
    const { initObservability } = await import('@/lib/observability');

    initObservability({
      app: 'admin',
      appEnv: 'production',
      dsn: 'https://example.ingest.sentry.io/456',
      release: 'sha-456',
    });

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://example.ingest.sentry.io/456',
        environment: 'production',
        release: 'sha-456',
      })
    );
  });

  it('does nothing when the DSN is missing', async () => {
    const { initObservability } = await import('@/lib/observability');

    initObservability({
      app: 'admin',
      appEnv: 'local',
      dsn: '',
      release: 'dev',
    });

    expect(Sentry.init).not.toHaveBeenCalled();
  });
});

describe('recordUserActionBreadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a support breadcrumb', async () => {
    const { recordUserActionBreadcrumb } = await import('@/lib/observability');

    recordUserActionBreadcrumb({
      category: 'admin',
      message: 'admin user updated',
      data: { userId: 'user_123' },
    });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'admin',
      data: { userId: 'user_123' },
      level: 'info',
      message: 'admin user updated',
    });
  });
});
