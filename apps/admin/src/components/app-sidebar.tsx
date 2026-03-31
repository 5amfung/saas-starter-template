'use client';

import * as React from 'react';
import {
  IconDashboard,
  IconHelp,
  IconHome,
  IconSearch,
  IconShieldHalfFilled,
  IconUsers,
} from '@tabler/icons-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar';
import { authClient } from '@workspace/auth/client';
import { NavAdmin } from '@/components/nav-admin';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser, NavUserSkeleton } from '@/components/nav-user';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: <IconDashboard /> },
  { title: 'Users', url: '/users', icon: <IconUsers /> },
];

const navSecondary = [
  { title: 'Search', url: '#', icon: <IconSearch /> },
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
];

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
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <IconShieldHalfFilled className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Admin Portal</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavAdmin items={navItems} />
        <NavSecondary items={navSecondary} className="mt-auto" />
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
