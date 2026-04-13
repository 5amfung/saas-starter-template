import * as Sentry from '@sentry/tanstackstart-react';

const environment = process.env.NODE_ENV ?? 'development';

Sentry.init({
  dsn: '',
  enabled: true,
  sendDefaultPii: true,
  enableLogs: true,
  debug: false,
  environment,
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
});
