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
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        `${request.method} ${request.url} - Error (${duration}ms):`,
        error
      );

      Sentry.captureException(error);

      throw error;
    }
  }
);
