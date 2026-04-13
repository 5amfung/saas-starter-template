import { createMiddleware } from '@tanstack/react-start';
import * as Sentry from '@sentry/tanstackstart-react';

/**
 * Logs method, URL, status, and duration for every request.
 */
export const requestLogger = createMiddleware().server(
  async ({ request, next }) => {
    const startTime = Date.now();

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      console.log(
        `${request.method} ${request.url} - ${result.response.status} (${duration}ms)`
      );

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errMessage = error instanceof Error ? error.message : String(error);
      const path = new URL(request.url).pathname;
      console.error(
        `${request.method} ${request.url} - ${errMessage} (${duration}ms):`,
        error
      );
      Sentry.captureException(error, {
        tags: {
          method: request.method,
          path,
          source: 'request-logger',
        },
        contexts: {
          request_logger: {
            path,
            duration_ms: duration,
            request_id: request.headers.get('x-request-id'),
          },
        },
      });
      throw error;
    }
  }
);
