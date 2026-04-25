// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as TanStackRouter from '@tanstack/react-router';
import { AdminAccessDeniedPage } from '@/routes/admin/access-denied';

const { navigateMock, signOutMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@/auth/client/auth-client', () => ({
  authClient: {
    signOut: signOutMock,
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>();

  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useNavigate: () => navigateMock,
  };
});

describe('admin access denied route', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockReset();
  });

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

  it('signs out before routing switch account to shared signin', async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValue(undefined);
    navigateMock.mockResolvedValue(undefined);

    render(<AdminAccessDeniedPage />);

    await user.click(screen.getByRole('button', { name: /switch account/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/signin',
      search: { redirect: '/admin' },
    });
  });
});
