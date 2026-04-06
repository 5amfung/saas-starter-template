// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '@/components/app-sidebar';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  useSessionMock,
  useActiveOrganizationMock,
  useWorkspaceAccessCapabilitiesQueryMock,
  useRouterStateMock,
  useWorkspaceListQueryMock,
  useWorkspaceDetailQueryMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  useActiveOrganizationMock: vi.fn(),
  useWorkspaceAccessCapabilitiesQueryMock: vi.fn(),
  useRouterStateMock: vi.fn(),
  useWorkspaceListQueryMock: vi.fn(),
  useWorkspaceDetailQueryMock: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    useSession: useSessionMock,
    useActiveOrganization: useActiveOrganizationMock,
  },
}));

vi.mock('@/policy/workspace-capabilities', () => ({
  useWorkspaceAccessCapabilitiesQuery: useWorkspaceAccessCapabilitiesQueryMock,
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
  }: {
    workspaces: Array<{ id: string; name: string }>;
    activeWorkspaceId: string | null;
  }) => (
    <div
      data-testid="workspace-switcher"
      data-active-id={activeWorkspaceId ?? ''}
      data-active-name={
        workspaces.find((workspace) => workspace.id === activeWorkspaceId)
          ?.name ?? ''
      }
      data-workspace-count={workspaces.length}
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

vi.mock('@workspace/components/layout', () => ({
  NavSecondary: ({
    items,
  }: {
    items: Array<{ title: string; url: string }>;
  }) => <nav data-testid="nav-secondary" data-item-count={items.length} />,
  NavUser: ({ user }: { user: { name: string; email: string } }) => (
    <div data-testid="nav-user" data-name={user.name} />
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
  useWorkspaceAccessCapabilitiesQueryMock.mockReturnValue({
    data: { canViewBilling: true, canViewSettings: true },
  });
  useWorkspaceListQueryMock.mockReturnValue({ data: mockOrgs });
  useWorkspaceDetailQueryMock.mockReturnValue({ data: null });
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
      '5'
    );
    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute(
      'href',
      '/ws/ws-1/billing'
    );
  });

  it('hides Settings nav item when workspace capabilities deny settings access', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useWorkspaceAccessCapabilitiesQueryMock.mockReturnValue({
      data: { canViewBilling: true, canViewSettings: false },
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
    useWorkspaceAccessCapabilitiesQueryMock.mockReturnValue({
      data: { canViewBilling: false, canViewSettings: true },
    });

    await renderSidebar();

    expect(screen.getByTestId('nav-main')).toHaveAttribute(
      'data-item-count',
      '4'
    );
    expect(
      screen.queryByRole('link', { name: 'Billing' })
    ).not.toBeInTheDocument();
  });
});
