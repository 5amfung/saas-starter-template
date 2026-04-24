// @vitest-environment jsdom
// apps/web/test/unit/components/not-found.test.tsx
import { render, screen } from '@testing-library/react';
import { NotFound } from '@/components/layout';

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({ children, to }: { children?: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('NotFound', () => {
  it('renders 404 message and home link', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText(/go back home/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go back home/i })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
