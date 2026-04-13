import * as Sentry from '@sentry/tanstackstart-react';

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
