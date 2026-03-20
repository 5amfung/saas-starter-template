'use client';

import * as React from 'react';
import {
  IconDashboard,
  IconFolder,
  IconHelp,
  IconHome,
  IconSearch,
  IconSettings,
  IconStack2,
  IconUsers,
} from '@tabler/icons-react';
import { authClient } from '@workspace/auth/client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@workspace/ui/components/sidebar';
import { NavAdmin } from '@/components/nav-admin';
import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser, NavUserSkeleton } from '@/components/nav-user';
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
  navAdmin: [
    { title: 'Dashboard', url: '/admin/dashboard', icon: <IconDashboard /> },
    { title: 'User', url: '/admin/user', icon: <IconUsers /> },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, isPending } = authClient.useSession();
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrganization } = authClient.useActiveOrganization();

  const activeWorkspaceId =
    activeOrganization?.id ?? organizations?.at(0)?.id ?? null;

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
        {
          title: 'Settings',
          url: `/ws/${activeWorkspaceId}/settings`,
          icon: <IconSettings />,
        },
      ]
    : [];

  const workspaces = (organizations ?? []).map((organization) => ({
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

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {session?.user.role === 'admin' && <NavAdmin items={data.navAdmin} />}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {isPending ? (
          <NavUserSkeleton />
        ) : user ? (
          <NavUser user={user} />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
