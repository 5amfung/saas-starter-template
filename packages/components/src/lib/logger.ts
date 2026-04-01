import { createIsomorphicFn, createMiddleware } from '@tanstack/react-start';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Creates an isomorphic logger tagged with the given service name.
 * Server: emits structured JSON in production, human-readable in dev.
 * Client: always emits to console.
 */
export function createLogger(service: string) {
  return createIsomorphicFn()
    .server((level: LogLevel, message: string, data?: unknown) => {
      const timestamp = new Date().toISOString();
      if (process.env.NODE_ENV === 'production') {
        // Structured JSON logging for production observability.
        console[level](
          JSON.stringify({
            timestamp,
            level,
            message,
            data,
            service,
            environment: process.env.NODE_ENV,
          })
        );
      } else {
        // Human-readable logging for development and test.
        console[level](
          `[${timestamp}] [${level.toUpperCase()}]`,
          message,
          data ?? ''
        );
      }
    })
    .client((level: LogLevel, message: string, data?: unknown) => {
      console[level](`[${level.toUpperCase()}]`, message, data ?? '');
      if (process.env.NODE_ENV === 'production') {
        // Production: Send to analytics service.
        // analytics.track('client_log', { level, message, data })
      }
    });
}

/**
 * Creates a server-side request logger middleware using the provided log function.
 * Logs method, URL, status, and duration for every request.
 */
export function createRequestLogger(
  log: (level: LogLevel, message: string, data?: unknown) => void
) {
  return createMiddleware().server(async ({ request, next }) => {
    const startTime = Date.now();
    try {
      const result = await next();
      const duration = Date.now() - startTime;
      log(
        'info',
        `${request.method} ${request.url} - ${result.response.status} (${duration}ms)`
      );
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      log(
        'error',
        `${request.method} ${request.url} - Error (${duration}ms):`,
        error
      );
      throw error;
    }
  });
}
