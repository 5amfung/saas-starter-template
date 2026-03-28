import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  const queryClient = new QueryClient();

  // Only enable cross-tab query sync in the browser. The BroadcastChannel
  // polyfill used during SSR (Node.js) is file-system-based and causes
  // EMFILE errors under load.
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
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};
