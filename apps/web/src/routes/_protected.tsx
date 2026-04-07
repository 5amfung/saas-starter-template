import { Outlet, createFileRoute } from '@tanstack/react-router';
import {
  SidebarInset,
  SidebarProvider,
} from '@workspace/ui/components/sidebar';
import { SiteHeader } from '@workspace/components/layout';
import type { WebAppEntry } from '@/policy/web-app-entry.shared';
import { AppSidebar } from '@/components/app-sidebar';
import { authMiddleware } from '@/middleware/auth';
import { useWebAppEntry } from '@/policy/web-app-entry';

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
  server: {
    middleware: [authMiddleware],
  },
});

export function canRenderProtectedLayout(entry?: WebAppEntry) {
  return entry?.kind === 'canEnterWebApp';
}

export function getProtectedLayoutState({
  entry,
  isPending,
  error,
}: {
  entry?: WebAppEntry;
  isPending: boolean;
  error: unknown;
}) {
  if (isPending) {
    return 'loading' as const;
  }

  if (error || !canRenderProtectedLayout(entry)) {
    return 'blocked' as const;
  }

  return 'ready' as const;
}

function ProtectedLayout() {
  const { data: entry, error, isPending } = useWebAppEntry();
  const state = getProtectedLayoutState({ entry, isPending, error });

  if (state !== 'ready') {
    return null;
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
