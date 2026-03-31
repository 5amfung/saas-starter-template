// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createRouterLinkMock } from '../../mocks/router';
import { NotFound } from '@/components/not-found';

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: createRouterLinkMock(),
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
