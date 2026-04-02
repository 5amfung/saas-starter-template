// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '@/components/app-sidebar';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    useSession: useSessionMock,
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
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul>{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <button>{children}</button>,
}));

vi.mock('@workspace/components/layout', () => ({
  NavAdmin: ({ items }: { items: Array<{ title: string; url: string }> }) => (
    <nav data-testid="nav-admin" data-item-count={items.length} />
  ),
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
  role: 'admin' as const,
};

const mockSession = { user: mockUser };

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
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

  it('renders Admin Portal branding in header', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
  });

  it('renders NavAdmin with navigation items', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    const navAdmin = screen.getByTestId('nav-admin');
    expect(navAdmin).toBeInTheDocument();
    // Dashboard, Users, Workspaces = 3 items.
    expect(navAdmin).toHaveAttribute('data-item-count', '3');
  });

  it('renders NavSecondary', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    expect(screen.getByTestId('nav-secondary')).toBeInTheDocument();
  });

  it('renders NavUser when session is loaded', async () => {
    useSessionMock.mockReturnValue({ data: mockSession, isPending: false });

    await renderSidebar();

    expect(screen.getByTestId('nav-user')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user-skeleton')).not.toBeInTheDocument();
  });

  it('renders NavUserSkeleton while session is pending', async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });

    await renderSidebar();

    expect(screen.getByTestId('nav-user-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-user')).not.toBeInTheDocument();
  });

  it('renders nothing in footer when no session and not pending', async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });

    await renderSidebar();

    expect(screen.queryByTestId('nav-user')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-user-skeleton')).not.toBeInTheDocument();
  });
});
