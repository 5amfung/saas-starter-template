// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { AppSidebar } from '@/components/app-sidebar';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  useSessionMock,
  useActiveOrganizationMock,
  useWorkspaceCapabilitiesQueryMock,
  useAdminAppCapabilitiesMock,
  useRouterStateMock,
  useWorkspaceListQueryMock,
  useWorkspaceDetailQueryMock,
  useWorkspaceSwitcherTriggerDetailQueryMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  useActiveOrganizationMock: vi.fn(),
  useWorkspaceCapabilitiesQueryMock: vi.fn(),
  useAdminAppCapabilitiesMock: vi.fn(),
  useRouterStateMock: vi.fn(),
  useWorkspaceListQueryMock: vi.fn(),
  useWorkspaceDetailQueryMock: vi.fn(),
  useWorkspaceSwitcherTriggerDetailQueryMock: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/auth/client/auth-client', () => ({
  authClient: {
    useSession: useSessionMock,
    useActiveOrganization: useActiveOrganizationMock,
  },
}));

vi.mock('@/policy/workspace-capabilities', () => ({
  useWorkspaceCapabilitiesQuery: useWorkspaceCapabilitiesQueryMock,
}));

vi.mock('@/policy/admin-app-capabilities', () => ({
  useAdminAppCapabilities: useAdminAppCapabilitiesMock,
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return {
    ...actual,
    useRouterState: useRouterStateMock,
  };
});

vi.mock('@/workspace/workspace.queries', () => ({
  useWorkspaceListQuery: useWorkspaceListQueryMock,
  useWorkspaceDetailQuery: useWorkspaceDetailQueryMock,
  useWorkspaceSwitcherTriggerDetailQuery:
    useWorkspaceSwitcherTriggerDetailQueryMock,
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
  Sidebar: ({ children, ...props }: React.ComponentProps<'aside'>) => (
    <aside data-testid="sidebar" {...props}>
      {children}
    </aside>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-footer">{children}</div>
  ),
}));

vi.mock('@/components/workspace-switcher', () => ({
  WorkspaceSwitcher: ({
    workspaces,
    activeWorkspaceId,
    triggerDetail,
  }: {
    workspaces: Array<{ id: string; name: string }>;
    activeWorkspaceId: string | null;
    triggerDetail?: { planName: string; memberCount: number } | null;
  }) => (
    <div
      data-testid="workspace-switcher"
      data-active-id={activeWorkspaceId ?? ''}
      data-active-name={
        workspaces.find((workspace) => workspace.id === activeWorkspaceId)
          ?.name ?? ''
      }
      data-workspace-count={workspaces.length}
      data-trigger-detail={JSON.stringify(triggerDetail ?? null)}
    />
  ),
}));

vi.mock('@/components/nav-main', () => ({
  NavMain: ({ items }: { items: Array<{ title: string; url: string }> }) => (
    <nav data-testid="nav-main" data-item-count={items.length}>
      {items.map((item) => (
        <a key={item.title} href={item.url}>
          {item.title}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock('@/components/layout', () => ({
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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  image: null,
  role: 'user' as const,
};

const mockSession = { user: mockUser };

const mockOrgs = [
  { id: 'ws-1', name: 'Workspace One' },
  { id: 'ws-2', name: 'Workspace Two' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  useRouterStateMock.mockImplementation(
    ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => string;
    }) => select({ location: { pathname: '/' } })
  );
  useWorkspaceCapabilitiesQueryMock.mockReturnValue({
    data: {
      canViewBilling: true,
      canViewSettings: true,
      canViewIntegrations: true,
    },
  });
  useAdminAppCapabilitiesMock.mockReturnValue({
    session: mockSession,
    isPending: false,
    capabilities: {
      platformRole: 'user',
      canAccessAdminApp: false,
      canViewDashboard: false,
      canViewAdminDashboard: false,
      canViewAnalytics: false,
      canViewUsers: false,
      canManageUsers: false,
      canDeleteUsers: false,
      canViewWorkspaces: false,
      canViewWorkspaceBilling: false,
      canManageEntitlementOverrides: false,
      canPerformSupportActions: false,
    },
  });
  useWorkspaceListQueryMock.mockReturnValue({ data: mockOrgs });
  useWorkspaceDetailQueryMock.mockReturnValue({ data: null });
  useWorkspaceSwitcherTriggerDetailQueryMock.mockReturnValue({
    data: undefined,
  });
  useActiveOrganizationMock.mockReturnValue({
    data: { id: 'ws-1', name: 'Workspace One' },
  });
});

describe('AppSidebar', () => {
  function renderSidebar() {
    render(<AppSidebar />);
  }

  it('renders all sidebar sections', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
  });

  it('renders WorkspaceSwitcher with active workspace', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    const switcher = screen.getByTestId('workspace-switcher');
    expect(switcher).toBeInTheDocument();
    expect(switcher).toHaveAttribute('data-active-id', 'ws-1');
    expect(switcher).toHaveAttribute('data-trigger-detail', 'null');
  });

  it('passes the loaded trigger detail into WorkspaceSwitcher', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceSwitcherTriggerDetailQueryMock.mockReturnValue({
      data: { planName: 'Pro', memberCount: 4 },
    });

    await renderSidebar();

    expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
      'data-trigger-detail',
      JSON.stringify({ planName: 'Pro', memberCount: 4 })
    );
    expect(useWorkspaceSwitcherTriggerDetailQueryMock).toHaveBeenCalledWith(
      'ws-1'
    );
  });

  it('falls back to a null trigger detail while the query is unresolved', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceSwitcherTriggerDetailQueryMock.mockReturnValue({
      data: undefined,
    });

    await renderSidebar();

    expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
      'data-trigger-detail',
      'null'
    );
  });

  it('prefers the route workspace over stale active organization state', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useActiveOrganizationMock.mockReturnValue({
      data: { id: 'ws-2', name: 'Workspace Two' },
    });
    useRouterStateMock.mockImplementation(
      ({
        select,
      }: {
        select: (state: { location: { pathname: string } }) => string;
      }) =>
        select({
          location: { pathname: '/ws/ws-1/overview' },
        })
    );

    await renderSidebar();

    expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
      'data-active-id',
      'ws-1'
    );
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/ws/ws-1/overview'
    );
  });

  it('overlays the active workspace detail onto the canonical workspace list', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceListQueryMock.mockReturnValue({
      data: [{ id: 'ws-1', name: 'Workspace One' }],
    });
    useWorkspaceDetailQueryMock.mockReturnValue({
      data: { id: 'ws-1', name: 'Workspace One Renamed' },
    });

    await renderSidebar();

    expect(screen.getByTestId('workspace-switcher')).toHaveAttribute(
      'data-active-name',
      'Workspace One Renamed'
    );
  });

  it('shows Billing nav item when workspace capabilities allow billing access', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    expect(screen.getByTestId('nav-main')).toHaveAttribute(
      'data-item-count',
      '6'
    );
    expect(
      within(screen.getByTestId('nav-main')).getByRole('link', {
        name: 'Billing',
      })
    ).toHaveAttribute('href', '/ws/ws-1/billing');
  });

  it('shows Integrations between Members and Billing when allowed', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    const links = within(screen.getByTestId('nav-main'))
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(links).toEqual([
      'Overview',
      'Projects',
      'Members',
      'Integrations',
      'Billing',
      'Settings',
    ]);
    expect(
      within(screen.getByTestId('nav-main')).getByRole('link', {
        name: 'Integrations',
      })
    ).toHaveAttribute('href', '/ws/ws-1/integrations');
  });

  it('hides Settings nav item when workspace capabilities deny settings access', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceCapabilitiesQueryMock.mockReturnValue({
      data: {
        canViewBilling: true,
        canViewSettings: false,
        canViewIntegrations: true,
      },
    });

    await renderSidebar();

    expect(
      screen.queryByRole('link', { name: 'Settings' })
    ).not.toBeInTheDocument();
  });

  it('renders NavMain with empty items when no workspace is active', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceListQueryMock.mockReturnValue({ data: [] });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    const navMain = screen.getByTestId('nav-main');
    expect(navMain).toHaveAttribute('data-item-count', '0');
  });

  it('renders NavSecondary', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.getByTestId('nav-secondary')).toBeInTheDocument();
  });

  it('renders NavUser when session is loaded', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.getByTestId('nav-user')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user-skeleton')).not.toBeInTheDocument();
  });

  it('passes the default account menu items to NavUser without Admin for non-admin users', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useActiveOrganizationMock.mockReturnValue({ data: null });
    useWorkspaceListQueryMock.mockReturnValue({ data: [] });

    await renderSidebar();

    const navUser = within(screen.getByTestId('nav-user'));

    expect(navUser.getByRole('link', { name: 'Account' })).toHaveAttribute(
      'href',
      '/account'
    );
    expect(navUser.getByRole('link', { name: 'Billing' })).toHaveAttribute(
      'href',
      '/billing'
    );
    expect(
      navUser.getByRole('link', { name: 'Notifications' })
    ).toHaveAttribute('href', '/notifications');
    expect(
      navUser.queryByRole('link', { name: 'Admin' })
    ).not.toBeInTheDocument();
  });

  it('adds the Admin account menu item when admin entry policy allows access', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { ...mockUser, role: 'admin' as const } },
      isPending: false,
    });
    useActiveOrganizationMock.mockReturnValue({ data: null });
    useWorkspaceListQueryMock.mockReturnValue({ data: [] });
    useAdminAppCapabilitiesMock.mockReturnValue({
      session: { user: { ...mockUser, role: 'admin' as const } },
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

    await renderSidebar();

    const links = within(screen.getByTestId('nav-user'))
      .getAllByRole('link')
      .map((link) => ({
        label: link.textContent,
        href: link.getAttribute('href'),
      }));
    expect(links).toEqual([
      { label: 'Account', href: '/account' },
      { label: 'Billing', href: '/billing' },
      { label: 'Notifications', href: '/notifications' },
      { label: 'Admin', href: '/admin' },
    ]);
  });

  it('renders NavUserSkeleton while session is pending', async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });
    useWorkspaceListQueryMock.mockReturnValue({ data: null });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.getByTestId('nav-user-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user')).not.toBeInTheDocument();
  });

  it('hides Billing nav item when workspace capabilities deny billing access', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceCapabilitiesQueryMock.mockReturnValue({
      data: {
        canViewBilling: false,
        canViewSettings: true,
        canViewIntegrations: true,
      },
    });

    await renderSidebar();

    expect(screen.getByTestId('nav-main')).toHaveAttribute(
      'data-item-count',
      '5'
    );
    expect(
      within(screen.getByTestId('nav-main')).queryByRole('link', {
        name: 'Billing',
      })
    ).not.toBeInTheDocument();
  });

  it('hides Integrations nav item when workspace capabilities deny integration access', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceCapabilitiesQueryMock.mockReturnValue({
      data: {
        canViewBilling: true,
        canViewSettings: true,
        canViewIntegrations: false,
      },
    });

    await renderSidebar();

    expect(
      within(screen.getByTestId('nav-main')).queryByRole('link', {
        name: 'Integrations',
      })
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('nav-main'))
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Overview', 'Projects', 'Members', 'Billing', 'Settings']);
  });
});
