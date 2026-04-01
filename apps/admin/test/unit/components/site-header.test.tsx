// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { SiteHeader } from '@workspace/components/layout';

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@workspace/ui/components/sidebar', () => ({
  SidebarTrigger: (props: React.ComponentProps<'button'>) => (
    <button data-testid="sidebar-trigger" {...props} />
  ),
}));

vi.mock('@workspace/ui/components/separator', () => ({
  Separator: (props: React.ComponentProps<'hr'>) => (
    <hr data-testid="separator" {...props} />
  ),
}));

// Mock router hooks so DynamicBreadcrumb (rendered by SiteHeader) doesn't need a router context.
vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return {
    ...actual,
    useMatches: () => [],
  };
});

vi.mock('@workspace/ui/components/breadcrumb', () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => (
    <nav data-testid="dynamic-breadcrumb">{children}</nav>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => (
    <ol>{children}</ol>
  ),
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => (
    <li>{children}</li>
  ),
  BreadcrumbLink: ({ children }: { children: React.ReactNode }) => (
    <a>{children}</a>
  ),
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  BreadcrumbSeparator: () => <li />,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SiteHeader', () => {
  it('renders the header element', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders the sidebar trigger', () => {
    render(<SiteHeader />);
    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument();
  });

  it('renders the dynamic breadcrumb', () => {
    render(<SiteHeader />);
    expect(screen.getByTestId('dynamic-breadcrumb')).toBeInTheDocument();
  });
});
