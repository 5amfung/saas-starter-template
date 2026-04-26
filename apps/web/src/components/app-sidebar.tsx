'use client';

import * as React from 'react';
import {
  IconCreditCard,
  IconDashboard,
  IconFolder,
  IconHelp,
  IconHome,
  IconNotification,
  IconPlugConnected,
  IconSearch,
  IconSettings,
  IconShield,
  IconStack2,
  IconUserCircle,
  IconUsers,
} from '@tabler/icons-react';
import { useRouterState } from '@tanstack/react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@workspace/ui/components/sidebar';
import { authClient } from '@/auth/client/auth-client';
import { NavSecondary, NavUser, NavUserSkeleton } from '@/components/layout';
import { NavMain } from '@/components/nav-main';
import { useAdminAppCapabilities } from '@/policy/admin-app-capabilities';
import { useWorkspaceCapabilitiesQuery } from '@/policy/workspace-capabilities';
import {
  useWorkspaceDetailQuery,
  useWorkspaceListQuery,
  useWorkspaceSwitcherTriggerDetailQuery,
} from '@/workspace/workspace.queries';
import { mergeCurrentWorkspaceIntoList } from '@/workspace/workspace.selectors';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';

const data = {
  navSecondary: [
    {
      title: 'Search',
      url: '#',
      icon: <IconSearch />,
    },
    {
      title: 'Get Help',
      url: 'https://github.com/5amfung',
      icon: <IconHelp />,
      newTab: true,
    },
    {
      title: 'Home Page',
      url: 'https://github.com/5amfung',
      icon: <IconHome />,
      newTab: true,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { data: session, isPending } = authClient.useSession();
  const { data: organizations } = useWorkspaceListQuery();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const routeWorkspaceId =
    pathname.match(/^\/ws\/([^/]+)(?:\/|$)/)?.[1] ?? null;

  const activeWorkspaceId =
    routeWorkspaceId ??
    activeOrganization?.id ??
    organizations?.at(0)?.id ??
    null;
  const { data: activeWorkspace } = useWorkspaceDetailQuery(activeWorkspaceId);
  const { data: triggerDetail } =
    useWorkspaceSwitcherTriggerDetailQuery(activeWorkspaceId);

  const { data: activeWorkspaceCapabilities } =
    useWorkspaceCapabilitiesQuery(activeWorkspaceId);
  const { capabilities: adminAppCapabilities } = useAdminAppCapabilities();

  const navMain = activeWorkspaceId
    ? [
        {
          title: 'Overview',
          url: `/ws/${activeWorkspaceId}/overview`,
          icon: <IconDashboard />,
        },
        {
          title: 'Projects',
          url: `/ws/${activeWorkspaceId}/projects`,
          icon: <IconFolder />,
        },
        {
          title: 'Members',
          url: `/ws/${activeWorkspaceId}/members`,
          icon: <IconUsers />,
        },
        ...(activeWorkspaceCapabilities?.canViewIntegrations
          ? [
              {
                title: 'Integrations',
                url: `/ws/${activeWorkspaceId}/integrations`,
                icon: <IconPlugConnected />,
              },
            ]
          : []),
        ...(activeWorkspaceCapabilities?.canViewBilling
          ? [
              {
                title: 'Billing',
                url: `/ws/${activeWorkspaceId}/billing`,
                icon: <IconCreditCard />,
              },
            ]
          : []),
        ...(activeWorkspaceCapabilities?.canViewSettings
          ? [
              {
                title: 'Settings',
                url: `/ws/${activeWorkspaceId}/settings`,
                icon: <IconSettings />,
              },
            ]
          : []),
      ]
    : [];

  const workspaceShellState = mergeCurrentWorkspaceIntoList(
    organizations,
    activeWorkspace
  );

  const workspaces = (workspaceShellState ?? []).map((organization) => ({
    id: organization.id,
    name: organization.name,
    logo: <IconStack2 className="size-4" />,
  }));

  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.image ?? '',
      }
    : null;

  const userMenuItems = [
    { label: 'Account', icon: <IconUserCircle />, href: '/account' },
    { label: 'Billing', icon: <IconCreditCard />, href: '/billing' },
    {
      label: 'Notifications',
      icon: <IconNotification />,
      href: '/notifications',
    },
    ...(adminAppCapabilities.canAccessAdminApp
      ? [{ label: 'Admin', icon: <IconShield />, href: '/admin' }]
      : []),
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          triggerDetail={triggerDetail ?? null}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {isPending ? (
          <NavUserSkeleton />
        ) : user ? (
          <NavUser user={user} menuItems={userMenuItems} />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
