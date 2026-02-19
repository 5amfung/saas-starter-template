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
      logo: <IconStack2 className="size-4" />,
    },
    {
      name: 'Acme Corp.',
      logo: <IconStack2 className="size-4" />,
    },
    {
      name: 'Evil Corp.',
      logo: <IconStack2 className="size-4" />,
    },
  ],
  navMain: [
    { title: 'Projects', url: '/projects', icon: <IconFolder /> },
    { title: 'Members', url: '/members', icon: <IconUsers /> },
    { title: 'Settings', url: '/settings', icon: <IconSettings /> },
    { title: 'Dashboard', url: '/dashboard', icon: <IconDashboard /> },
  ],
  navSecondary: [
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
