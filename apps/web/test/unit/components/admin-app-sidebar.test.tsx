// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import type * as React from 'react';
import { AdminAppSidebar } from '@/components/admin-app-sidebar';

const { useSessionMock, useAdminAppCapabilitiesMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  useAdminAppCapabilitiesMock: vi.fn(),
}));

vi.mock('@/auth/client/auth-client', () => ({
  authClient: {
    useSession: useSessionMock,
  },
}));

vi.mock('@/policy/admin-app-capabilities', () => ({
  useAdminAppCapabilities: useAdminAppCapabilitiesMock,
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
  Sidebar: ({ children, ...props }: React.ComponentProps<'aside'>) => (
    <aside data-testid="sidebar" {...props}>
      {children}
    </aside>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-footer">{children}</div>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu">{children}</div>
  ),
  SidebarMenuButton: ({
    children,
    ...props
  }: React.ComponentProps<'button'>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/layout', () => ({
  NavAdmin: ({ items }: { items: Array<{ title: string; url: string }> }) => (
    <nav data-testid="nav-admin" data-item-count={items.length}>
      {items.map((item) => (
        <a key={item.title} href={item.url}>
          {item.title}
        </a>
      ))}
    </nav>
  ),
  NavSecondary: ({
    items,
  }: {
    items: Array<{ title: string; url: string }>;
  }) => <nav data-testid="nav-secondary" data-item-count={items.length} />,
  NavUser: ({
    user,
    menuItems,
  }: {
    user: { name: string; email: string };
    menuItems: Array<{ label: string; href: string }>;
  }) => (
    <div data-testid="nav-user" data-name={user.name}>
      {menuItems.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </div>
  ),
  NavUserSkeleton: () => <div data-testid="nav-user-skeleton" />,
}));

const mockUser = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  image: null,
  role: 'admin' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  useSessionMock.mockReturnValue({
    data: { user: mockUser },
    isPending: false,
  });
  useAdminAppCapabilitiesMock.mockReturnValue({
    session: { user: mockUser },
    isPending: false,
    capabilities: {
      platformRole: 'admin',
      canAccessAdminApp: true,
      canViewDashboard: true,
      canViewAdminDashboard: true,
      canViewAnalytics: true,
      canViewUsers: true,
      canManageUsers: true,
      canDeleteUsers: true,
      canViewWorkspaces: true,
      canViewWorkspaceBilling: true,
      canManageEntitlementOverrides: true,
      canPerformSupportActions: true,
    },
  });
});

describe('AdminAppSidebar', () => {
  function renderSidebar() {
    render(<AdminAppSidebar />);
  }

  it('passes account menu item to NavUser', () => {
    renderSidebar();

    const links = within(screen.getByTestId('nav-user'))
      .getAllByRole('link')
      .map((link) => ({
        label: link.textContent,
        href: link.getAttribute('href'),
      }));

    expect(links).toEqual([{ label: 'Account', href: '/account' }]);
  });

  it('renders NavUserSkeleton while session is pending', () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });

    renderSidebar();

    expect(screen.getByTestId('nav-user-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user')).not.toBeInTheDocument();
  });
});
