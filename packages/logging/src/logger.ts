import { createIsomorphicFn } from '@tanstack/react-start';
import { normalizeLogContext } from './request-context';
import type { ObservabilityContext } from './request-context';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function isObservabilityContext(data: unknown): data is ObservabilityContext {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

/**
 * Creates an isomorphic logger tagged with the given service name.
 * Server: emits structured JSON in production, human-readable in dev.
 * Client: always emits to console.
 */
export function createLogger(service: string) {
  return createIsomorphicFn()
    .server((level: LogLevel, message: string, data?: unknown) => {
      const timestamp = new Date().toISOString();
      const context = isObservabilityContext(data)
        ? normalizeLogContext(data)
        : undefined;
      if (process.env.NODE_ENV === 'production') {
        // Structured JSON logging for production observability.
        console[level](
          JSON.stringify({
            timestamp,
            level,
            message,
            service,
            environment: process.env.NODE_ENV,
            ...context,
            data,
          })
        );
      } else {
        // Human-readable logging for development and test.
        console[level](
          `[${timestamp}] [${level.toUpperCase()}]`,
          message,
          context ?? '',
          data ?? ''
        );
      }
    })
    .client((level: LogLevel, message: string, data?: unknown) => {
      const context = isObservabilityContext(data)
        ? normalizeLogContext(data)
        : undefined;
      console[level](
        `[${level.toUpperCase()}]`,
        message,
        context ?? '',
        data ?? ''
      );
      if (process.env.NODE_ENV === 'production') {
        // Production: Send to analytics service.
        // analytics.track('client_log', { level, message, data })
      }
    });
}
