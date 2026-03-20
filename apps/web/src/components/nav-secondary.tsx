'use client';

import * as React from 'react';
import { IconBrightness, IconExternalLink } from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { useTheme } from '@/components/theme-provider';

export function NavSecondary({
  items,
  ...props
}: {
  items: Array<{
    title: string;
    url: string;
    icon: React.ReactNode;
    newTab?: boolean;
  }>;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { setTheme } = useTheme();
  const { isMobile } = useSidebar();

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton />}>
                <IconBrightness />
                <span>Theme</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={
                  <a
                    href={item.url}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noreferrer noopener' : undefined}
                  />
                }
              >
                {item.icon}
                <span>{item.title}</span>
                {item.newTab ? <IconExternalLink className="size-4" /> : null}
                {item.newTab ? (
                  <span className="sr-only">(opens in a new tab)</span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
