import { createIsomorphicFn } from '@tanstack/react-start';
import { normalizeLogPayload } from './request-context';

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
      const payload = normalizeLogPayload(data);
      if (process.env.NODE_ENV === 'production') {
        // Structured JSON logging for production observability.
        console[level](
          JSON.stringify({
            timestamp,
            level,
            message,
            service,
            environment: process.env.NODE_ENV,
            ...payload,
          })
        );
      } else {
        // Human-readable logging for development and test.
        console[level](
          `[${timestamp}] [${level.toUpperCase()}]`,
          message,
          payload ?? ''
        );
      }
    })
    .client((level: LogLevel, message: string, data?: unknown) => {
      const payload = normalizeLogPayload(data);
      console[level](`[${level.toUpperCase()}]`, message, payload ?? '');
      if (process.env.NODE_ENV === 'production') {
        // Production: Send to analytics service.
        // analytics.track('client_log', { level, message, data })
      }
    });
}
