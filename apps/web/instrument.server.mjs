import * as Sentry from '@sentry/tanstackstart-react';

const environment = process.env.NODE_ENV ?? 'development';

Sentry.init({
  dsn: 'https://dd69e55eb484ba69311475f4bce106d0@o4511209278865408.ingest.us.sentry.io/4511209281355776',
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
