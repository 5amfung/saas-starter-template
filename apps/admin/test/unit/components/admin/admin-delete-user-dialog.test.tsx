// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { AdminDeleteUserDialog } from '@/components/admin/admin-delete-user-dialog';

const { removeUserMock, navigateMock } = vi.hoisted(() => ({
  removeUserMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('@/admin/users.functions', () => ({
  deleteUser: removeUserMock,
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await import('@tanstack/react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

beforeEach(() => vi.clearAllMocks());

describe('AdminDeleteUserDialog', () => {
  it('renders delete button', () => {
    renderWithProviders(
      <AdminDeleteUserDialog userId="user-1" userEmail="user@example.com" />
    );
    expect(
      screen.getByRole('button', { name: /delete user/i })
    ).toBeInTheDocument();
  });

  it('disables trigger when disabled prop is true', () => {
    renderWithProviders(
      <AdminDeleteUserDialog
        userId="user-1"
        userEmail="user@example.com"
        disabled
      />
    );
    expect(screen.getByRole('button', { name: /delete user/i })).toBeDisabled();
  });

  it('opens dialog showing user email', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdminDeleteUserDialog userId="user-1" userEmail="user@example.com" />
    );
    await user.click(screen.getByRole('button', { name: /delete user/i }));
    expect(await screen.findByText(/user@example.com/)).toBeInTheDocument();
  });

  it('requires DELETE confirmation to enable confirm button', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdminDeleteUserDialog userId="user-1" userEmail="user@example.com" />
    );
    await user.click(screen.getByRole('button', { name: /delete user/i }));

    const confirmButton = await screen.findByRole('button', {
      name: /confirm delete/i,
    });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText('DELETE');
    await user.type(input, 'DELETE');
    expect(confirmButton).toBeEnabled();
  });

  it('calls removeUser and navigates on success', async () => {
    removeUserMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(
      <AdminDeleteUserDialog userId="user-1" userEmail="user@example.com" />
    );
    await user.click(screen.getByRole('button', { name: /delete user/i }));

    const input = screen.getByPlaceholderText('DELETE');
    await user.type(input, 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(removeUserMock).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/users' })
      );
    });
  });
});
