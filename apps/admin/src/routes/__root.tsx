import { TanStackDevtools } from '@tanstack/react-devtools';
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { Toaster } from '@workspace/ui/components/sonner';
import appCss from '@workspace/ui/globals.css?url';
import {
  NotFound,
  ThemeProvider,
  useTheme,
} from '@workspace/components/layout';
import type { QueryClient } from '@tanstack/react-query';
import { AppErrorBoundary } from '@/components/error-boundary';

interface RouterContext {
  queryClient: QueryClient;
}

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
        title: 'Admin Portal',
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
        <AppErrorBoundary>
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
        </AppErrorBoundary>
      </body>
    </html>
  );
}
