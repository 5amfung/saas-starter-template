import { createMiddleware } from '@tanstack/react-start';
import { normalizeLogContext } from './request-context';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Creates a server-side request logger middleware using the provided log function.
 * Logs method, URL, status, and duration for every request.
 */
export function createRequestLogger(
  log: (level: LogLevel, message: string, data?: unknown) => void
) {
  return createMiddleware().server(async ({ request, next }) => {
    const startTime = Date.now();
    const url = new URL(request.url);
    const operation = `${request.method} ${url.pathname}`;
    const requestId = request.headers.get('x-request-id') ?? undefined;
    try {
      const result = await next();
      const duration = Date.now() - startTime;
      log('info', 'request completed', {
        ...normalizeLogContext({
          requestId,
          route: url.pathname,
          operation,
          statusCode: result.response.status,
          durationMs: duration,
        }),
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      log('error', 'request failed', {
        ...normalizeLogContext({
          requestId,
          route: url.pathname,
          operation,
          durationMs: duration,
        }),
        error,
      });
      throw error;
    }
  });
}
