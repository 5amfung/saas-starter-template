import { useEffect } from 'react';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  SidebarInset,
  SidebarProvider,
} from '@workspace/ui/components/sidebar';
import { SiteHeader } from '@workspace/components/layout';
import { AppSidebar } from '@/components/app-sidebar';
import { authMiddleware } from '@/middleware/auth';
import { useAdminAppCapabilities } from '@/policy/admin-app-capabilities';

export const Route = createFileRoute('/_protected')({
  component: ProtectedLayout,
  server: {
    middleware: [authMiddleware],
  },
});

function ProtectedLayout() {
  const navigate = useNavigate();
  const { capabilities, isPending } = useAdminAppCapabilities();
  const isAuthenticated = capabilities.canAccessAdminApp;

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      navigate({ to: '/signin' });
    }
  }, [isAuthenticated, isPending, navigate]);

  if (isPending || !isAuthenticated) {
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
