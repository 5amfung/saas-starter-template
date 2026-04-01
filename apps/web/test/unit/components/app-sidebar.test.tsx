// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '@/components/app-sidebar';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  useSessionMock,
  useListOrganizationsMock,
  useActiveOrganizationMock,
  useActiveMemberRoleQueryMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  useListOrganizationsMock: vi.fn(),
  useActiveOrganizationMock: vi.fn(),
  useActiveMemberRoleQueryMock: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    useSession: useSessionMock,
    useListOrganizations: useListOrganizationsMock,
    useActiveOrganization: useActiveOrganizationMock,
  },
}));

vi.mock('@/hooks/use-active-member-role-query', () => ({
  useActiveMemberRoleQuery: useActiveMemberRoleQueryMock,
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
      data-workspace-count={workspaces.length}
    />
  ),
}));

vi.mock('@/components/nav-main', () => ({
  NavMain: ({ items }: { items: Array<{ title: string; url: string }> }) => (
    <nav data-testid="nav-main" data-item-count={items.length} />
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
  useActiveMemberRoleQueryMock.mockReturnValue({ data: 'owner' });
});

describe('AppSidebar', () => {
  function renderSidebar() {
    render(<AppSidebar />);
  }

  it('renders all sidebar sections', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({
      data: { id: 'ws-1', name: 'Workspace One' },
    });

    await renderSidebar();

    expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
  });

  it('renders WorkspaceSwitcher with active workspace', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({
      data: { id: 'ws-1', name: 'Workspace One' },
    });

    await renderSidebar();

    const switcher = screen.getByTestId('workspace-switcher');
    expect(switcher).toBeInTheDocument();
    expect(switcher).toHaveAttribute('data-active-id', 'ws-1');
  });

  it('renders NavMain with workspace nav items when workspace is active', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({
      data: { id: 'ws-1', name: 'Workspace One' },
    });

    await renderSidebar();

    // Overview, Projects, Members, Billing, Settings = 5 items.
    expect(screen.getByTestId('nav-main')).toHaveAttribute(
      'data-item-count',
      '5'
    );
  });

  it('renders NavMain with empty items when no workspace is active', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: [] });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    const navMain = screen.getByTestId('nav-main');
    expect(navMain).toHaveAttribute('data-item-count', '0');
  });

  it('renders NavSecondary', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.getByTestId('nav-secondary')).toBeInTheDocument();
  });

  it('renders NavUser when session is loaded', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.getByTestId('nav-user')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user-skeleton')).not.toBeInTheDocument();
  });

  it('renders NavUserSkeleton while session is pending', async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });
    useListOrganizationsMock.mockReturnValue({ data: null });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.getByTestId('nav-user-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user')).not.toBeInTheDocument();
  });

  it('hides Billing nav item for non-owner workspace members', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({
      data: { id: 'ws-1', name: 'Workspace One' },
    });
    useActiveMemberRoleQueryMock.mockReturnValue({ data: 'member' });

    await renderSidebar();

    // Overview, Projects, Members, Settings = 4 items (no Billing).
    expect(screen.getByTestId('nav-main')).toHaveAttribute(
      'data-item-count',
      '4'
    );
  });
});
