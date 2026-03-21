// @vitest-environment jsdom
import { IconHome, IconSettings } from '@tabler/icons-react';
import { render, screen } from '@testing-library/react';
import { NavMain } from '@/components/nav-main';

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
  SidebarGroupContent: ({
    children,
    ...props
  }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
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
    const Tag = renderProp ? 'a' : 'button';
    const renderHref =
      renderProp && 'props' in renderProp
        ? (renderProp.props as { to?: string }).to
        : undefined;
    return (
      <Tag
        href={renderHref}
        data-active={isActive ? 'true' : undefined}
        {...props}
      >
        {children}
      </Tag>
    );
  },
}));

const items = [
  { title: 'Overview', url: '/ws/ws-1/overview', icon: <IconHome /> },
  { title: 'Settings', url: '/ws/ws-1/settings', icon: <IconSettings /> },
];

beforeEach(() => {
  vi.clearAllMocks();
  matchRouteMock.mockReturnValue(null);
});

describe('NavMain', () => {
  it('renders workspace label', () => {
    render(<NavMain items={items} />);
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('renders all navigation item titles', () => {
    render(<NavMain items={items} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders links with correct hrefs', () => {
    render(<NavMain items={items} />);
    const overviewLink = screen.getByRole('link', { name: /overview/i });
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    expect(overviewLink).toHaveAttribute('href', '/ws/ws-1/overview');
    expect(settingsLink).toHaveAttribute('href', '/ws/ws-1/settings');
  });

  it('marks item as active when route matches', () => {
    matchRouteMock.mockImplementation(({ to }: { to: string }) =>
      to === '/ws/ws-1/overview' ? { id: 'overview' } : null
    );
    render(<NavMain items={items} />);
    const overviewLink = screen.getByRole('link', { name: /overview/i });
    expect(overviewLink).toHaveAttribute('data-active', 'true');
  });

  it('does not mark item as active when route does not match', () => {
    matchRouteMock.mockReturnValue(null);
    render(<NavMain items={items} />);
    const settingsLink = screen.getByRole('link', { name: /settings/i });
    expect(settingsLink).not.toHaveAttribute('data-active', 'true');
  });

  it('renders items without icons', () => {
    const noIconItems = [{ title: 'Projects', url: '/ws/ws-1/projects' }];
    render(<NavMain items={noIconItems} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });
});
