import * as Sentry from '@sentry/tanstackstart-react';
import type { MetricName } from './operations';

type MetricAttributeValue = string | number | boolean;
type MetricAttributes = Record<string, MetricAttributeValue | null | undefined>;

const BLOCKED_METRIC_ATTRIBUTE_KEYS = new Set([
  'email',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'subscriptionId',
  'token',
  'userId',
  'workspaceId',
]);

const DYNAMIC_SEGMENT_PATTERN = /^(?:[0-9]+|[0-9a-f]{8,}|[A-Za-z0-9_-]{16,})$/;

function sanitizeMetricAttributes(attributes: MetricAttributes) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key, value]) => {
      if (value === null || value === undefined) return false;
      return !BLOCKED_METRIC_ATTRIBUTE_KEYS.has(key);
    })
  );
}

export function emitCountMetric(
  name: MetricName,
  attributes: MetricAttributes = {},
  value = 1
) {
  Sentry.metrics.count(name, value, {
    attributes: sanitizeMetricAttributes(attributes),
  });
}

export function emitDistributionMetric(
  name: MetricName,
  value: number,
  unit: string,
  attributes: MetricAttributes = {}
) {
  Sentry.metrics.distribution(name, value, {
    unit,
    attributes: sanitizeMetricAttributes(attributes),
  });
}

export function normalizeApiMetricPath(input: string): string | null {
  const pathname = new URL(input, 'http://local.test').pathname;
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.startsWith('/api/auth/')) return '/api/auth/$';

  return pathname
    .split('/')
    .map((segment) =>
      DYNAMIC_SEGMENT_PATTERN.test(segment) ? ':param' : segment
    )
    .join('/');
}
