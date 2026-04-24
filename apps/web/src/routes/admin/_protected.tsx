import { useEffect } from 'react';
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import {
  SidebarInset,
  SidebarProvider,
} from '@workspace/ui/components/sidebar';
import { SiteHeader } from '@workspace/components/layout';
import type { AdminAppEntry } from '@/policy/admin-app-capabilities.shared';
import { AdminAppSidebar } from '@/components/admin-app-sidebar';
import { getAdminAppEntry } from '@/policy/admin-app-capabilities.functions';
import { getAdminAppEntryRedirect } from '@/policy/admin-app-capabilities.shared';
import { useAdminAppEntry } from '@/policy/admin-app-capabilities';

export const Route = createFileRoute('/admin/_protected')({
  beforeLoad: async () => {
    const entry = await getAdminAppEntry();
    const redirectTarget = getProtectedLayoutRedirectTarget(entry);

    if (redirectTarget) {
      throw redirect(redirectTarget);
    }
  },
  component: ProtectedLayout,
});

export function canRenderProtectedLayout(entry?: AdminAppEntry) {
  return entry?.kind === 'canEnterAdminApp';
}

export function getProtectedLayoutRedirectTarget(entry?: AdminAppEntry) {
  if (!entry || canRenderProtectedLayout(entry)) {
    return null;
  }

  return (
    getAdminAppEntryRedirect(entry, 'protected') ?? {
      to: '/signin',
      search: { redirect: '/admin/dashboard' },
    }
  );
}

export function getProtectedLayoutState({
  entry,
  isPending,
  error,
}: {
  entry?: AdminAppEntry;
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
  const navigate = useNavigate();
  const { data: entry, error, isPending } = useAdminAppEntry();
  const state = getProtectedLayoutState({ entry, isPending, error });
  const redirectTarget =
    state === 'blocked' ? getProtectedLayoutRedirectTarget(entry) : null;

  useEffect(() => {
    if (redirectTarget) {
      navigate(redirectTarget);
    }
  }, [navigate, redirectTarget]);

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
      <AdminAppSidebar variant="inset" />
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
