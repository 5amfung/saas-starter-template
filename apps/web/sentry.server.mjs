import * as Sentry from '@sentry/tanstackstart-react';

const SERVER_SENTRY_STATE_KEY = Symbol.for(
  'workspace.web.sentry.server.initialized'
);

function getServerSentryState() {
  globalThis[SERVER_SENTRY_STATE_KEY] ??= { initialized: false };
  return globalThis[SERVER_SENTRY_STATE_KEY];
}

export function isServerSentryEnabled(env = process.env) {
  return env.NODE_ENV !== 'test' && env.VITE_SENTRY_DISABLED !== 'true';
}

export function getServerSentryDsn(env = process.env) {
  return env.SENTRY_DSN ?? env.VITE_SENTRY_DSN;
}

export function getServerSentryEnvironment(env = process.env) {
  return env.VERCEL_ENV ?? env.NODE_ENV ?? 'development';
}

export function initializeServerSentry(env = process.env) {
  if (!isServerSentryEnabled(env)) {
    return false;
  }

  const state = getServerSentryState();

  if (state.initialized) {
    return false;
  }

  Sentry.init({
    dsn: getServerSentryDsn(env),
    enabled: true,
    enableLogs: true,
    environment: getServerSentryEnvironment(env),
    integrations: [
      // Send console.log, console.warn, and console.error calls as logs to Sentry.
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    ],
    sendDefaultPii: true,
    tracePropagationTargets: ['localhost', /^\/api\//],
    tracesSampleRate: 1.0,
    tunnel: '/tunnel',
  });

  state.initialized = true;

  return true;
}

initializeServerSentry();
