'use client';

import * as React from 'react';
import {
  IconBuilding,
  IconDashboard,
  IconHelp,
  IconHome,
  IconSearch,
  IconShieldHalfFilled,
  IconUserCircle,
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
import { authClient } from '@/auth/client/auth-client';
import {
  NavAdmin,
  NavSecondary,
  NavUser,
  NavUserSkeleton,
} from '@/components/layout';
import { useAdminAppCapabilities } from '@/policy/admin-app-capabilities';

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
    url: '/',
    icon: <IconHome />,
  },
];

export function AdminAppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { data: session, isPending } = authClient.useSession();
  const { capabilities } = useAdminAppCapabilities();
  const navItems = React.useMemo(
    () =>
      [
        capabilities.canViewDashboard
          ? {
              title: 'Dashboard',
              url: '/admin/dashboard',
              icon: <IconDashboard />,
            }
          : null,
        capabilities.canViewUsers
          ? { title: 'Users', url: '/admin/users', icon: <IconUsers /> }
          : null,
        capabilities.canViewWorkspaces
          ? {
              title: 'Workspaces',
              url: '/admin/workspaces',
              icon: <IconBuilding />,
            }
          : null,
      ].filter((item) => item !== null),
    [capabilities]
  );

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
          <NavUser
            user={user}
            menuItems={[
              {
                label: 'Account',
                icon: <IconUserCircle />,
                href: '/account',
              },
            ]}
          />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
