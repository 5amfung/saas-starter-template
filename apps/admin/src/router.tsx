import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import * as Sentry from '@sentry/tanstackstart-react';
import { routeTree } from './routeTree.gen';

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
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      enabled: true,
      enableLogs: true,
      environment: import.meta.env.MODE,
      integrations: [
        // Send console.log, console.warn, and console.error calls as logs to Sentry
        Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
        Sentry.replayIntegration(),
        Sentry.tanstackRouterBrowserTracingIntegration(router),
      ],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      sendDefaultPii: true,
      tracePropagationTargets: ['localhost', /^\/api\//],
      tracesSampleRate: 1.0,
      tunnel: '/tunnel',
    });
  }

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};
