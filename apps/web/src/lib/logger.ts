import { createIsomorphicFn, createMiddleware } from '@tanstack/react-start';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const logger = createIsomorphicFn()
  .server((level: LogLevel, message: string, data?: any) => {
    const timestamp = new Date().toISOString();

    if (process.env.NODE_ENV === 'production') {
      // Structured JSON logging for production observability.
      console[level](
        JSON.stringify({
          timestamp,
          level,
          message,
          data,
          service: 'sass',
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
  .client((level: LogLevel, message: string, data?: any) => {
    console[level](`[${level.toUpperCase()}]`, message, data ?? '');
    if (process.env.NODE_ENV === 'production') {
      // Production: Send to analytics service
      // analytics.track('client_log', { level, message, data })
    }
  });

export const requestLogger = createMiddleware().server(
  async ({ request, next }) => {
    const startTime = Date.now();

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      logger(
        'info',
        `${request.method} ${request.url} - ${result.response.status} (${duration}ms)`
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger(
        'error',
        `${request.method} ${request.url} - Error (${duration}ms):`,
        error
      );
      throw error;
    }
  }
);
