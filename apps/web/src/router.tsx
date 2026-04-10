import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { captureRouterError, initObservability } from '@/lib/observability';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  initObservability({
    app: 'web',
    appEnv:
      process.env.APP_ENV === 'staging' || process.env.APP_ENV === 'production'
        ? process.env.APP_ENV
        : 'local',
    dsn: process.env.SENTRY_DSN,
    release: process.env.APP_RELEASE,
  });

  const queryClient = new QueryClient();

  // Only enable cross-tab query sync in the browser.
  if (typeof window !== 'undefined') {
    broadcastQueryClient({
      queryClient,
      broadcastChannel: 'query-sync',
    });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    notFoundMode: 'root',
    defaultOnCatch: (error, errorInfo) => {
      captureRouterError(error, errorInfo);
    },
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};
