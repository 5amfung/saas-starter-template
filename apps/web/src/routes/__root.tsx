import { TanStackDevtools } from '@tanstack/react-devtools';
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { withErrorBoundary } from '@sentry/tanstackstart-react';
import { Toaster } from '@workspace/ui/components/sonner';
import appCss from '@workspace/ui/globals.css?url';
import type { QueryClient } from '@tanstack/react-query';
import {
  AppErrorBoundary,
  NotFound,
  ThemeProvider,
  useTheme,
} from '@/components/layout';

interface RouterContext {
  queryClient: QueryClient;
}

export const SentryAppErrorBoundary = withErrorBoundary(AppErrorBoundary, {});

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => <SentryAppErrorBoundary error={error} />,
});

/** Passes the resolved theme from ThemeProvider to the UI Toaster. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} />;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider defaultTheme="system" storageKey="app-theme">
          {children}
          <ThemedToaster />
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'TanStack Query',
                render: <ReactQueryDevtoolsPanel />,
                defaultOpen: false,
              },
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              formDevtoolsPlugin(),
            ]}
          />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  );
}
