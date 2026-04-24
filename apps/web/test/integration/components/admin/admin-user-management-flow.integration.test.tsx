// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OPERATIONS } from '@workspace/logging/client';
import { renderWithProviders } from '@workspace/test-utils';
import type * as LoggingClient from '@workspace/logging/client';
import { AdminUserForm } from '@/components/admin/admin-user-form';
import { AdminDeleteUserDialog } from '@/components/admin/admin-delete-user-dialog';

const {
  adminUpdateUserMock,
  adminRemoveUserMock,
  navigateMock,
  mockToastSuccess,
  mockToastError,
  startSpanMock,
} = vi.hoisted(() => ({
  adminUpdateUserMock: vi.fn(),
  adminRemoveUserMock: vi.fn(),
  navigateMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  startSpanMock: vi.fn(async (_options, callback: () => Promise<unknown>) =>
    callback()
  ),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {},
}));

vi.mock('@/admin/users.functions', () => ({
  updateUser: adminUpdateUserMock,
  deleteUser: adminRemoveUserMock,
}));

vi.mock('@workspace/logging/client', async (importActual) => {
  const actual = await importActual<typeof LoggingClient>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
  };
});

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  role: 'user',
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-03-01T00:00:00.000Z',
  lastSignInAt: '2025-03-13T00:00:00.000Z',
};

describe('Admin user management flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('edit user flow', () => {
    it('edits user name and submits the form', async () => {
      const user = userEvent.setup();
      adminUpdateUserMock.mockResolvedValue({});

      renderWithProviders(<AdminUserForm user={mockUser} />);

      const nameInput = screen.getByDisplayValue('Test User');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated User');
      await user.tab();

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await waitFor(() => expect(saveButton).toBeEnabled());
      await user.click(saveButton);

      await waitFor(() => {
        expect(adminUpdateUserMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'user-1',
            }),
          })
        );
      });

      expect(startSpanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          op: OPERATIONS.ADMIN_USER_UPDATE,
          name: 'Update admin user',
          attributes: expect.objectContaining({
            operation: OPERATIONS.ADMIN_USER_UPDATE,
            targetUserId: 'user-1',
            route: '/admin/users/$userId',
            result: 'attempt',
          }),
        }),
        expect.any(Function)
      );
    });

    it('updates the role to admin and shows a success toast', async () => {
      const user = userEvent.setup();
      adminUpdateUserMock.mockResolvedValue({});

      renderWithProviders(<AdminUserForm user={mockUser} />);

      const roleSelect = screen.getByRole('combobox', { name: /role/i });
      await user.click(roleSelect);

      const adminOption = await screen.findByRole('option', {
        name: /admin/i,
      });
      await user.click(adminOption);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await waitFor(() => expect(saveButton).toBeEnabled());
      await user.click(saveButton);

      await waitFor(() => {
        expect(adminUpdateUserMock).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'user-1',
              role: 'admin',
            }),
          })
        );
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'User updated successfully.'
        );
      });
    });

    it('cancels edit and reverts to original values', async () => {
      const user = userEvent.setup();

      renderWithProviders(<AdminUserForm user={mockUser} />);

      const nameInput = screen.getByDisplayValue('Test User');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed Name');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await waitFor(() => expect(cancelButton).toBeEnabled());
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });
    });
  });

  describe('delete user flow', () => {
    it('opens dialog, types confirmation, deletes, and navigates', async () => {
      const user = userEvent.setup();
      adminRemoveUserMock.mockResolvedValue({});

      renderWithProviders(
        <AdminDeleteUserDialog userId="user-1" userEmail="test@example.com" />
      );

      await user.click(screen.getByRole('button', { name: /delete user/i }));

      const confirmButton = await screen.findByRole('button', {
        name: /confirm delete/i,
      });
      expect(confirmButton).toBeDisabled();

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'DELETE');
      expect(confirmButton).toBeEnabled();

      await user.click(confirmButton);

      await waitFor(() => {
        expect(adminRemoveUserMock).toHaveBeenCalledWith({
          data: { userId: 'user-1' },
        });
      });

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith(
          expect.objectContaining({ to: '/admin/users' })
        );
      });

      expect(startSpanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          op: OPERATIONS.ADMIN_USER_DELETE,
          name: 'Delete admin user',
          attributes: expect.objectContaining({
            operation: OPERATIONS.ADMIN_USER_DELETE,
            targetUserId: 'user-1',
            route: '/admin/users/$userId',
            result: 'attempt',
          }),
        }),
        expect.any(Function)
      );
    });

    it('does not enable confirm button with wrong confirmation text', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AdminDeleteUserDialog userId="user-1" userEmail="test@example.com" />
      );

      await user.click(screen.getByRole('button', { name: /delete user/i }));

      const input = screen.getByPlaceholderText('DELETE');
      await user.type(input, 'WRONG');

      const confirmButton = screen.getByRole('button', {
        name: /confirm delete/i,
      });
      expect(confirmButton).toBeDisabled();
    });
  });
});
