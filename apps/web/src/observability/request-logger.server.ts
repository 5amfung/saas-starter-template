import { createMiddleware } from '@tanstack/react-start';
import * as Sentry from '@sentry/tanstackstart-react';
import { METRICS } from './operations';
import {
  emitDistributionMetric,
  normalizeApiMetricPath,
} from './metrics.server';

export function getStatusFamily(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

export function recordApiLatencyMetric(input: {
  method: string;
  url: string;
  status: number;
  durationMs: number;
}) {
  const path = normalizeApiMetricPath(input.url);
  if (!path) return;

  emitDistributionMetric(
    METRICS.API_REQUEST_LATENCY_MS,
    input.durationMs,
    'ms',
    {
      method: input.method,
      path,
      statusFamily: getStatusFamily(input.status),
      result: input.status >= 500 ? 'failure' : 'success',
    }
  );
}

/**
 * Logs method, URL, status, and duration for every request.
 */
export const requestLogger = createMiddleware().server(
  async ({ request, next }) => {
    const startTime = Date.now();
    const path = new URL(request.url).pathname;

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      recordApiLatencyMetric({
        method: request.method,
        url: request.url,
        status: result.response.status,
        durationMs: duration,
      });

      console.log(
        `${request.method} ${path} - ${result.response.status} (${duration}ms)`
      );

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errMessage = error instanceof Error ? error.message : String(error);
      recordApiLatencyMetric({
        method: request.method,
        url: request.url,
        status: 500,
        durationMs: duration,
      });
      console.error(
        `${request.method} ${path} - [ERROR] ${errMessage} (${duration}ms)`
      );
      Sentry.captureException(error, {
        tags: {
          method: request.method,
          path,
          source: 'request-logger',
        },
        contexts: {
          request_logger: {
            duration_ms: duration,
          },
        },
      });
      throw error;
    }
  }
);
