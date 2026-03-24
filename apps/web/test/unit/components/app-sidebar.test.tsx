// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { AppSidebar } from '@/components/app-sidebar';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  useSessionMock,
  useListOrganizationsMock,
  useActiveOrganizationMock,
  getActiveMemberRoleMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  useListOrganizationsMock: vi.fn(),
  useActiveOrganizationMock: vi.fn(),
  getActiveMemberRoleMock: vi
    .fn()
    .mockResolvedValue({ data: { role: 'owner' } }),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    useSession: useSessionMock,
    useListOrganizations: useListOrganizationsMock,
    useActiveOrganization: useActiveOrganizationMock,
    organization: {
      getActiveMemberRole: getActiveMemberRoleMock,
    },
  },
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

vi.mock('@/components/nav-admin', () => ({
  NavAdmin: ({ items }: { items: Array<{ title: string; url: string }> }) => (
    <nav data-testid="nav-admin" data-item-count={items.length} />
  ),
}));

vi.mock('@/components/nav-secondary', () => ({
  NavSecondary: ({
    items,
  }: {
    items: Array<{ title: string; url: string }>;
  }) => <nav data-testid="nav-secondary" data-item-count={items.length} />,
}));

vi.mock('@/components/nav-user', () => ({
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
});

describe('AppSidebar', () => {
  /**
   * Renders AppSidebar and waits for the async useEffect (getActiveMemberRole)
   * to settle so React doesn't warn about unhandled state updates.
   */
  async function renderSidebar() {
    render(<AppSidebar />);
    // Wait for the async role-check effect to complete.
    await waitFor(() => {
      expect(getActiveMemberRoleMock).toHaveBeenCalled();
    });
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

  it('renders NavAdmin only for admin users', async () => {
    const adminSession = { user: { ...mockUser, role: 'admin' as const } };
    useSessionMock.mockReturnValue({ data: adminSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.getByTestId('nav-admin')).toBeInTheDocument();
  });

  it('does not render NavAdmin for regular users', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });
    useListOrganizationsMock.mockReturnValue({ data: mockOrgs });
    useActiveOrganizationMock.mockReturnValue({ data: null });

    await renderSidebar();

    expect(screen.queryByTestId('nav-admin')).not.toBeInTheDocument();
  });
});
