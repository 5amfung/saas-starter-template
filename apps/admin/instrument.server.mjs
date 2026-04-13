import * as Sentry from '@sentry/tanstackstart-react';

const environment = process.env.NODE_ENV ?? 'development';

// TODO
Sentry.init({
  debug: false,
  dsn: '',
  enabled: true,
  enableLogs: true,
  environment,
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  sendDefaultPii: true,
  // tracesSampleRate: 1.0,
});
