import * as Sentry from '@sentry/tanstackstart-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  METRICS,
  emitCountMetric,
  emitDistributionMetric,
  normalizeApiMetricPath,
} from '@/observability/server';

vi.mock('@sentry/tanstackstart-react', () => ({
  metrics: {
    count: vi.fn(),
    distribution: vi.fn(),
  },
}));

const countMetricMock = vi.mocked(Sentry.metrics.count);
const distributionMetricMock = vi.mocked(Sentry.metrics.distribution);

describe('server metric helpers', () => {
  beforeEach(() => {
    countMetricMock.mockClear();
    distributionMetricMock.mockClear();
  });

  it('emits count metrics through the Sentry Metrics API', () => {
    emitCountMetric(METRICS.AUTH_SIGNUP_CREATED, {
      route: '/api/auth/$',
      result: 'success',
      userId: 'must-not-ship',
      email: 'person@example.com',
    });

    expect(countMetricMock).toHaveBeenCalledWith('auth.signup.created', 1, {
      attributes: {
        route: '/api/auth/$',
        result: 'success',
      },
    });
  });

  it('emits distribution metrics with a unit', () => {
    emitDistributionMetric(METRICS.API_REQUEST_LATENCY_MS, 42, 'ms', {
      method: 'POST',
      path: '/api/auth/$',
      statusFamily: '2xx',
    });

    expect(distributionMetricMock).toHaveBeenCalledWith(
      'api.request.latency_ms',
      42,
      {
        unit: 'ms',
        attributes: {
          method: 'POST',
          path: '/api/auth/$',
          statusFamily: '2xx',
        },
      }
    );
  });

  it.each([
    ['/api/auth/sign-in/email?x=1', '/api/auth/$'],
    ['/api/auth/callback/google', '/api/auth/$'],
    ['/api/messaging/hello', '/api/messaging/hello'],
    ['/api/test/emails?to=a@example.com', '/api/test/emails'],
    ['/api/workspaces/123456789abcdef', '/api/workspaces/:param'],
    ['/not-api/path', null],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeApiMetricPath(input)).toBe(expected);
  });
});
