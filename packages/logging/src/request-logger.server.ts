import { createMiddleware } from '@tanstack/react-start';

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
