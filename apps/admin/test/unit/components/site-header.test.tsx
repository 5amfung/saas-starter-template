// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { SiteHeader } from '@/components/site-header';

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

vi.mock('@/components/dynamic-breadcrumb', () => ({
  DynamicBreadcrumb: () => <nav data-testid="dynamic-breadcrumb" />,
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
