import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar';
import type { ReactNode } from 'react';

export function NavAdmin({
  items,
}: {
  items: Array<{
    title: string;
    url: string;
    icon: ReactNode;
  }>;
}) {
  const matchRoute = useMatchRoute();

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              isActive={!!matchRoute({ to: item.url, fuzzy: true })}
              render={<Link to={item.url} />}
            >
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
