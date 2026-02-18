'use client';

import * as React from 'react';
import {
  IconChartBar,
  IconCommand,
  IconDashboard,
  IconFolder,
  IconHelp,
  IconHome,
  IconInnerShadowTop,
  IconListDetails,
  IconSearch,
  IconSettings,
  IconUsers,
  IconWaveSquare,
} from '@tabler/icons-react';
import { authClient } from '@/auth/auth-client';
import { NavAdmin } from '@/components/nav-admin';
import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { NavUser, NavUserSkeleton } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';

const data = {
  workspaces: [
    {
      name: 'Acme Inc',
      logo: <IconInnerShadowTop className="size-4" />,
    },
    {
      name: 'Acme Corp.',
      logo: <IconWaveSquare className="size-4" />,
    },
    {
      name: 'Evil Corp.',
      logo: <IconCommand className="size-4" />,
    },
  ],
  navMain: [
    { title: 'Dashboard', url: '/dashboard', icon: <IconDashboard /> },
    { title: 'Lifecycle', url: '/lifecycle', icon: <IconListDetails /> },
    { title: 'Analytics', url: '/analytics', icon: <IconChartBar /> },
    { title: 'Projects', url: '/projects', icon: <IconFolder /> },
    { title: 'Team', url: '/team', icon: <IconUsers /> },
  ],
  navSecondary: [
    {
      title: 'Settings',
      url: '#',
      icon: <IconSettings />,
    },
    {
      title: 'Search',
      url: '#',
      icon: <IconSearch />,
    },
    {
      title: 'Get Help',
      url: '#',
      icon: <IconHelp />,
      newTab: true,
    },
    {
      title: 'Home Page',
      url: 'https://github.com/5amfung/sass-starter-template',
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
        <WorkspaceSwitcher workspaces={data.workspaces} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
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
