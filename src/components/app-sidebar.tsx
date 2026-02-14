'use client';

import * as React from 'react';
import {
  IconChartBar,
  IconDashboard,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconSearch,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { authClient } from '@/auth/auth-client';
import { NavAdmin } from '@/components/nav-admin';
import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser, NavUserSkeleton } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '#',
      icon: <IconDashboard />,
    },
    {
      title: 'Lifecycle',
      url: '#',
      icon: <IconListDetails />,
    },
    {
      title: 'Analytics',
      url: '#',
      icon: <IconChartBar />,
    },
    {
      title: 'Projects',
      url: '#',
      icon: <IconFolder />,
    },
    {
      title: 'Team',
      url: '#',
      icon: <IconUsers />,
    },
  ],
  navSecondary: [
    {
      title: 'Settings',
      url: '#',
      icon: <IconSettings />,
    },
    {
      title: 'Get Help',
      url: '#',
      icon: <IconHelp />,
    },
    {
      title: 'Search',
      url: '#',
      icon: <IconSearch />,
    },
  ],
  navAdmin: [
    {
      name: 'Dashboard',
      url: '/admin/dashboard',
      icon: <IconDashboard />,
    },
    {
      name: 'User',
      url: '/admin/user',
      icon: <IconUsers />,
    },
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="#" />}
            >
              <IconInnerShadowTop className="size-5!" />
              <span className="text-base font-semibold">Acme Inc.</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavAdmin items={data.navAdmin} />
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
