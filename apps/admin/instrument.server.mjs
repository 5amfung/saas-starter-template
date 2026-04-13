import * as Sentry from '@sentry/tanstackstart-react';

Sentry.init({
  dsn: '',
  enabled: true,
  sendDefaultPii: true,
  enableLogs: true,
  debug: false,
  environment: 'development',
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
});
