import * as Sentry from '@sentry/react';

type AppEnv = 'local' | 'staging' | 'production';

export function initObservability(config: {
  app: 'web';
  appEnv: AppEnv;
  dsn?: string;
  release?: string;
}) {
  if (!config.dsn) {
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
