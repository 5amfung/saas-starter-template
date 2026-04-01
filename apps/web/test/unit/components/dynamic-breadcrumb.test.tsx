// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { DynamicBreadcrumb } from '@workspace/components/layout';

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

    // Breadcrumb nav renders but has no list items with text.
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('renders a single breadcrumb as a page (not a link)', () => {
    useMatchesMock.mockReturnValue([
      {
        id: 'overview',
        fullPath: '/ws/ws-1/overview',
        staticData: { title: 'Overview' },
      },
    ]);

    render(<DynamicBreadcrumb />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    // Last item should be current page, not a link.
    expect(screen.getByText('Overview')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('renders multiple breadcrumbs with links for non-last items', () => {
    useMatchesMock.mockReturnValue([
      {
        id: 'ws',
        fullPath: '/ws',
        staticData: { title: 'Workspace' },
      },
      {
        id: 'overview',
        fullPath: '/ws/ws-1/overview',
        staticData: { title: 'Overview' },
      },
    ]);

    render(<DynamicBreadcrumb />);

    // "Workspace" is not the last item, so it should render as a link.
    const workspaceLink = screen.getByRole('link', { name: 'Workspace' });
    expect(workspaceLink).toBeInTheDocument();
    expect(workspaceLink).toHaveAttribute('href', '/ws');

    // "Overview" is the last item, so it should be the current page.
    expect(screen.getByText('Overview')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('uses breadcrumbHref from staticData when provided', () => {
    useMatchesMock.mockReturnValue([
      {
        id: 'settings',
        fullPath: '/ws/ws-1/settings/profile',
        staticData: { title: 'Settings', breadcrumbHref: '/ws/ws-1/settings' },
      },
      {
        id: 'profile',
        fullPath: '/ws/ws-1/settings/profile',
        staticData: { title: 'Profile' },
      },
    ]);

    render(<DynamicBreadcrumb />);

    const settingsLink = screen.getByRole('link', { name: 'Settings' });
    expect(settingsLink).toHaveAttribute('href', '/ws/ws-1/settings');
  });

  it('filters out route matches without a title', () => {
    useMatchesMock.mockReturnValue([
      { id: 'root', fullPath: '/', staticData: {} },
      {
        id: 'ws',
        fullPath: '/ws',
        staticData: { title: 'Workspace' },
      },
    ]);

    render(<DynamicBreadcrumb />);

    // Only "Workspace" should appear — the root match has no title.
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
