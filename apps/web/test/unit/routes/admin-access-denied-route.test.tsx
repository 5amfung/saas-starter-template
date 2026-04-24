// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as TanStackRouter from '@tanstack/react-router';
import { AdminAccessDeniedPage } from '@/routes/admin/access-denied';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>();

  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe('admin access denied route', () => {
  it('explains the current account is not allowed into admin', () => {
    render(<AdminAccessDeniedPage />);

    expect(
      screen.getByRole('heading', { name: /access denied/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/current account does not have admin access/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to app/i })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
