import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import * as Sentry from '@sentry/tanstackstart-react';
import { routeTree } from './routeTree.gen';

const sentryEnvironment = import.meta.env.MODE;

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Only enable cross-tab query sync in the browser.
  if (typeof window !== 'undefined') {
    broadcastQueryClient({
      queryClient,
      broadcastChannel: 'admin-query-sync',
    });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    notFoundMode: 'root',
  });

  if (!router.isServer) {
    // TODO
    Sentry.init({
      debug: true,
      dsn: '',
      enabled: true,
      enableLogs: true,
      environment: sentryEnvironment,
      integrations: [
        // Sentry.tanstackRouterBrowserTracingIntegration(router),
        // Sentry.replayIntegration(),
        // send console.log, console.warn, and console.error calls as logs to Sentry
        Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
      ],
      // replaysOnErrorSampleRate: 1.0,
      // replaysSessionSampleRate: 0.1,
      sendDefaultPii: true,
      // tracesSampleRate: 1.0,
    });
  }

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};
