// @vitest-environment jsdom
import { IconShield, IconUsers } from '@tabler/icons-react';
import { render, screen } from '@testing-library/react';
import { NavAdmin } from '@workspace/components/layout';

const { matchRouteMock } = vi.hoisted(() => ({
  matchRouteMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...rest
    }: {
      children?: React.ReactNode;
      to?: string;
      [key: string]: unknown;
    }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
    useMatchRoute: () => matchRouteMock,
  };
});

vi.mock('@workspace/ui/components/sidebar', () => ({
  SidebarGroup: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  SidebarGroupLabel: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  SidebarMenu: ({ children, ...props }: React.ComponentProps<'ul'>) => (
    <ul {...props}>{children}</ul>
  ),
  SidebarMenuItem: ({ children, ...props }: React.ComponentProps<'li'>) => (
    <li {...props}>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    render: renderProp,
    isActive,
    ...props
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
    isActive?: boolean;
    [key: string]: unknown;
  }) => {
    const renderHref =
      renderProp && 'props' in renderProp
        ? (renderProp.props as { to?: string }).to
        : undefined;
    return (
      <a
        href={renderHref}
        data-active={isActive ? 'true' : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
}));

const items = [
  { title: 'Dashboard', url: '/dashboard', icon: <IconShield /> },
  { title: 'Users', url: '/users', icon: <IconUsers /> },
];

beforeEach(() => {
  vi.clearAllMocks();
  matchRouteMock.mockReturnValue(null);
});

describe('NavAdmin', () => {
  it('renders Navigation label', () => {
    render(<NavAdmin items={items} />);
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('renders all navigation item titles', () => {
    render(<NavAdmin items={items} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders links with correct hrefs', () => {
    render(<NavAdmin items={items} />);
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const usersLink = screen.getByRole('link', { name: /users/i });
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    expect(usersLink).toHaveAttribute('href', '/users');
  });

  it('marks item as active when route matches', () => {
    matchRouteMock.mockImplementation(({ to }: { to: string }) =>
      to === '/users' ? { id: 'users' } : null
    );
    render(<NavAdmin items={items} />);
    const usersLink = screen.getByRole('link', { name: /users/i });
    expect(usersLink).toHaveAttribute('data-active', 'true');
  });

  it('does not mark item as active when route does not match', () => {
    matchRouteMock.mockReturnValue(null);
    render(<NavAdmin items={items} />);
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveAttribute('data-active', 'true');
  });
});
