import * as Sentry from '@sentry/node';

type AppEnv = 'local' | 'staging' | 'production';

export function initObservability(config: {
  app: 'api-server';
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

export function captureServerError(
  error: unknown,
  context: {
    requestId?: string;
    route?: string;
  }
) {
  Sentry.withScope((scope) => {
    if (context.requestId) {
      scope.setTag('requestId', context.requestId);
    }

    if (context.route) {
      scope.setTag('route', context.route);
    }

    scope.setContext('request', {
      requestId: context.requestId,
      route: context.route,
    });

    Sentry.captureException(error);
  });
}
