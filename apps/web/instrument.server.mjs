import * as Sentry from '@sentry/tanstackstart-react';

export function isServerSentryEnabled(env = process.env) {
  return env.NODE_ENV !== 'test' && env.VITE_SENTRY_DISABLED !== 'true';
}

const sentryEnabled = isServerSentryEnabled();

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: true,
    enableLogs: true,
    environment: process.env.NODE_ENV ?? 'development',
    integrations: [
      // Send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    ],
    sendDefaultPii: true,
    tracePropagationTargets: ['localhost', /^\/api\//],
    tracesSampleRate: 1.0,
    tunnel: '/tunnel',
  });
}
