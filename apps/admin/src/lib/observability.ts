import * as Sentry from '@sentry/react';
import type { ErrorInfo } from 'react';

type AppEnv = 'local' | 'staging' | 'production';
let isObservabilityInitialized = false;

export function initObservability(config: {
  app: 'admin';
  appEnv: AppEnv;
  dsn?: string;
  release?: string;
}) {
  if (!config.dsn || isObservabilityInitialized) {
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.appEnv,
    release: config.release,
    initialScope: {
      tags: {
        app: config.app,
      },
    },
    tracesSampleRate: 0,
  });
  isObservabilityInitialized = true;
}

export function recordUserActionBreadcrumb(input: {
  category: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  Sentry.addBreadcrumb({
    category: input.category,
    message: input.message,
    data: input.data,
    level: 'info',
  });
}

export function recordWorkflowBreadcrumb(input: {
  category: string;
  operation: string;
  message: string;
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  route?: string;
}) {
  Sentry.addBreadcrumb({
    category: input.category,
    message: input.message,
    level: 'info',
    data: {
      operation: input.operation,
      requestId: input.requestId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      route: input.route,
    },
  });
}

export function captureRouterError(error: Error, errorInfo?: ErrorInfo) {
  Sentry.withScope((scope) => {
    if (errorInfo?.componentStack) {
      scope.setContext('react', {
        componentStack: errorInfo.componentStack,
      });
    }

    Sentry.captureException(error);
  });
}
