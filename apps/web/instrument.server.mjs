import * as Sentry from '@sentry/tanstackstart-react';

const environment = process.env.NODE_ENV ?? 'development';

// TODO
Sentry.init({
  debug: false,
  dsn: 'https://dd69e55eb484ba69311475f4bce106d0@o4511209278865408.ingest.us.sentry.io/4511209281355776',
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
