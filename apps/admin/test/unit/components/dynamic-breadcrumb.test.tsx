// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { DynamicBreadcrumb } from '@/components/dynamic-breadcrumb';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { useMatchesMock } = vi.hoisted(() => ({
  useMatchesMock: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return {
    ...actual,
    useMatches: useMatchesMock,
    Link: ({
      children,
      to,
      ...rest
    }: {
      children?: React.ReactNode;
      to?: string;
      [key: string]: unknown;
    }) => (
      <a href={to} {...(rest as React.ComponentProps<'a'>)}>
        {children}
      </a>
    ),
  };
});

vi.mock('@workspace/ui/components/breadcrumb', () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => (
    <nav aria-label="breadcrumb">{children}</nav>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => (
    <ol>{children}</ol>
  ),
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  BreadcrumbLink: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => {
    if (renderProp) {
      return React.cloneElement(renderProp, {}, children);
    }
    return <a>{children}</a>;
  },
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
    <span aria-current="page">{children}</span>
  ),
  BreadcrumbSeparator: () => <li aria-hidden="true">/</li>,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DynamicBreadcrumb', () => {
  it('renders nothing when no matches have titles', () => {
    useMatchesMock.mockReturnValue([
      { id: 'root', fullPath: '/', staticData: {} },
    ]);

    render(<DynamicBreadcrumb />);

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('renders a single breadcrumb as a page (not a link)', () => {
    useMatchesMock.mockReturnValue([
      {
        id: 'overview',
        fullPath: '/dashboard',
        staticData: { title: 'Dashboard' },
      },
    ]);

    render(<DynamicBreadcrumb />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('renders multiple breadcrumbs with links for non-last items', () => {
    useMatchesMock.mockReturnValue([
      {
        id: 'admin',
        fullPath: '/dashboard',
        staticData: { title: 'Dashboard' },
      },
      {
        id: 'users',
        fullPath: '/users',
        staticData: { title: 'Users' },
      },
    ]);

    render(<DynamicBreadcrumb />);

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');

    expect(screen.getByText('Users')).toHaveAttribute('aria-current', 'page');
  });

  it('filters out route matches without a title', () => {
    useMatchesMock.mockReturnValue([
      { id: 'root', fullPath: '/', staticData: {} },
      {
        id: 'dashboard',
        fullPath: '/dashboard',
        staticData: { title: 'Dashboard' },
      },
    ]);

    render(<DynamicBreadcrumb />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
