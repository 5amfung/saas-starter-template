import { createMiddleware } from '@tanstack/react-start';
import * as Sentry from '@sentry/tanstackstart-react';

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

      console.log(
        `${request.method} ${path} - ${result.response.status} (${duration}ms)`
      );

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errMessage = error instanceof Error ? error.message : String(error);
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
