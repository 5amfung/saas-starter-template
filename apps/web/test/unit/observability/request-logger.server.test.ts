import { beforeEach, describe, expect, it, vi } from 'vitest';

const emitDistributionMetricMock = vi.fn();

vi.mock('@/observability/metrics.server', () => ({
  emitDistributionMetric: emitDistributionMetricMock,
  normalizeApiMetricPath: (input: string) => {
    const pathname = new URL(input, 'http://local.test').pathname;
    if (pathname.startsWith('/api/auth/')) return '/api/auth/$';
    if (pathname.startsWith('/api/')) return pathname;
    return null;
  },
}));

vi.mock('@/observability/operations', async (importActual) => ({
  ...(await importActual<object>()),
  METRICS: { API_REQUEST_LATENCY_MS: 'api.request.latency_ms' },
}));

describe('request logger API latency metric helper', () => {
  beforeEach(() => {
    vi.resetModules();
    emitDistributionMetricMock.mockClear();
  });

  it('records API latency for successful responses', async () => {
    const { recordApiLatencyMetric } =
      await import('@/observability/request-logger.server');

    recordApiLatencyMetric({
      method: 'POST',
      url: 'https://app.test/api/auth/sign-in/email?ignored=1',
      status: 200,
      durationMs: 42,
    });

    expect(emitDistributionMetricMock).toHaveBeenCalledWith(
      'api.request.latency_ms',
      42,
      'ms',
      {
        method: 'POST',
        path: '/api/auth/$',
        statusFamily: '2xx',
        result: 'success',
      }
    );
  });

  it('records failed API latency with a 5xx status family', async () => {
    const { recordApiLatencyMetric } =
      await import('@/observability/request-logger.server');

    recordApiLatencyMetric({
      method: 'GET',
      url: 'https://app.test/api/messaging/hello',
      status: 500,
      durationMs: 13,
    });

    expect(emitDistributionMetricMock).toHaveBeenCalledWith(
      'api.request.latency_ms',
      13,
      'ms',
      {
        method: 'GET',
        path: '/api/messaging/hello',
        statusFamily: '5xx',
        result: 'failure',
      }
    );
  });

  it('skips non-API paths', async () => {
    const { recordApiLatencyMetric } =
      await import('@/observability/request-logger.server');

    recordApiLatencyMetric({
      method: 'GET',
      url: 'https://app.test/ws/abc',
      status: 200,
      durationMs: 12,
    });

    expect(emitDistributionMetricMock).not.toHaveBeenCalled();
  });
});
