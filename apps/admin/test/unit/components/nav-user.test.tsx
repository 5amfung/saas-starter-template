// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavUser, NavUserSkeleton } from '@/components/nav-user';

const { signOutMock, navigateMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    signOut: signOutMock,
  },
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(),
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
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
  }) => (
    <button {...(props as React.ComponentProps<'button'>)}>{children}</button>
  ),
  useSidebar: () => ({ isMobile: false }),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@workspace/ui/components/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock('@workspace/ui/components/avatar', () => ({
  Avatar: ({ children, ...props }: React.ComponentProps<'span'>) => (
    <span {...props}>{children}</span>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <img src={src} alt={alt} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@workspace/ui/components/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children, ...props }: React.ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

const defaultUser = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  avatar: 'https://example.com/avatar.jpg',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NavUserSkeleton', () => {
  it('renders skeleton elements', () => {
    render(<NavUserSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('NavUser', () => {
  it('renders user name', () => {
    render(<NavUser user={defaultUser} />);
    const nameEls = screen.getAllByText('Jane Doe');
    expect(nameEls.length).toBeGreaterThan(0);
  });

  it('renders user email', () => {
    render(<NavUser user={defaultUser} />);
    const emailEls = screen.getAllByText('jane@example.com');
    expect(emailEls.length).toBeGreaterThan(0);
  });

  it('renders user avatar image', () => {
    render(<NavUser user={defaultUser} />);
    const avatarImages = screen.getAllByAltText('Jane Doe');
    expect(avatarImages[0]).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    );
  });

  it('renders account navigation option', () => {
    render(<NavUser user={defaultUser} />);
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders log out option', () => {
    render(<NavUser user={defaultUser} />);
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });

  it('calls signOut and navigates on log out click', async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValue(undefined);

    render(<NavUser user={defaultUser} />);

    await user.click(screen.getByText('Log out'));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
    });
  });

  it('shows error toast when sign out fails', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    signOutMock.mockRejectedValue(new Error('Network error'));

    render(<NavUser user={defaultUser} />);

    await user.click(screen.getByText('Log out'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Logout failed. Please try again.'
      );
    });
  });

  it('navigates to account page when Account is clicked', async () => {
    const user = userEvent.setup();
    render(<NavUser user={defaultUser} />);

    await user.click(screen.getByText('Account'));

    expect(navigateMock).toHaveBeenCalledWith({ to: '/account' });
  });
});
