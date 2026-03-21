// @vitest-environment jsdom
import { IconHelp, IconHome } from '@tabler/icons-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavSecondary } from '@/components/nav-secondary';

const { setThemeMock } = vi.hoisted(() => ({
  setThemeMock: vi.fn(),
}));

vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: setThemeMock,
    resolvedTheme: 'light',
  }),
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
  SidebarGroup: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  SidebarGroupContent: ({
    children,
    ...props
  }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  SidebarMenu: ({ children, ...props }: React.ComponentProps<'ul'>) => (
    <ul {...props}>{children}</ul>
  ),
  SidebarMenuItem: ({ children, ...props }: React.ComponentProps<'li'>) => (
    <li {...props}>{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    render: renderProp,
    ...props
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
    [key: string]: unknown;
  }) => {
    if (renderProp && 'props' in renderProp) {
      const anchorProps =
        renderProp.props as React.AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <a
          href={anchorProps.href}
          target={anchorProps.target}
          rel={anchorProps.rel}
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <button {...(props as React.ComponentProps<'button'>)}>{children}</button>
    );
  },
  useSidebar: () => ({ isMobile: false }),
}));

vi.mock('@workspace/ui/components/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    render: _renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

const items = [
  { title: 'Home', url: 'https://example.com', icon: <IconHome /> },
  {
    title: 'Help',
    url: 'https://docs.example.com',
    icon: <IconHelp />,
    newTab: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NavSecondary', () => {
  it('renders theme toggle button', () => {
    render(<NavSecondary items={items} />);
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });

  it('renders all navigation item titles', () => {
    render(<NavSecondary items={items} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('renders item links with correct hrefs', () => {
    render(<NavSecondary items={items} />);
    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toHaveAttribute('href', 'https://example.com');
  });

  it('renders new tab items with target _blank', () => {
    render(<NavSecondary items={items} />);
    const helpLink = screen.getByRole('link', { name: /help/i });
    expect(helpLink).toHaveAttribute('target', '_blank');
    expect(helpLink).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('renders screen reader text for new tab items', () => {
    render(<NavSecondary items={items} />);
    expect(screen.getByText('(opens in a new tab)')).toBeInTheDocument();
  });

  it('calls setTheme with light when Light is clicked', async () => {
    const user = userEvent.setup();
    render(<NavSecondary items={items} />);
    await user.click(screen.getByText('Light'));
    expect(setThemeMock).toHaveBeenCalledWith('light');
  });

  it('calls setTheme with dark when Dark is clicked', async () => {
    const user = userEvent.setup();
    render(<NavSecondary items={items} />);
    await user.click(screen.getByText('Dark'));
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with system when System is clicked', async () => {
    const user = userEvent.setup();
    render(<NavSecondary items={items} />);
    await user.click(screen.getByText('System'));
    expect(setThemeMock).toHaveBeenCalledWith('system');
  });
});
