// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OPERATIONS } from '@workspace/logging/client';
import { renderWithProviders } from '@workspace/test-utils';
import type * as LoggingClient from '@workspace/logging/client';
import { AdminUserForm } from '@/components/admin/admin-user-form';

const { updateUserMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(),
}));

const { startSpanMock } = vi.hoisted(() => ({
  startSpanMock: vi.fn(async (_options, callback: () => Promise<unknown>) =>
    callback()
  ),
}));

vi.mock('@/admin/users.functions', () => ({
  updateUser: updateUserMock,
}));

vi.mock('@workspace/logging/client', async (importActual) => {
  const actual = await importActual<typeof LoggingClient>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
  };
});

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

beforeEach(() => vi.clearAllMocks());

describe('AdminUserForm', () => {
  it('renders user profile fields', () => {
    renderWithProviders(<AdminUserForm user={mockUser} />);
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
  });

  it('renders user ID as read-only', () => {
    renderWithProviders(<AdminUserForm user={mockUser} />);
    const input = screen.getByDisplayValue('user-1');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('readOnly');
  });

  it('disables save button when form is clean', () => {
    renderWithProviders(<AdminUserForm user={mockUser} />);
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });

  it('disables cancel button when form is clean', () => {
    renderWithProviders(<AdminUserForm user={mockUser} />);
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();
  });

  it('enables save button after editing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUserForm user={mockUser} />);

    const nameInput = screen.getByDisplayValue('Test User');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it('calls updateUser on submit', async () => {
    updateUserMock.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(<AdminUserForm user={mockUser} />);

    const nameInput = screen.getByDisplayValue('Test User');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    await user.tab();

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith(
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
          route: '/users/$userId',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
  });

  it('renders the form in read-only mode without edit capability', () => {
    renderWithProviders(
      <AdminUserForm user={mockUser} canManageUsers={false} />
    );

    expect(
      screen.getByText(/can view this profile but cannot edit it/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeDisabled();
  });

  it('reverts changes on cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUserForm user={mockUser} />);

    const nameInput = screen.getByDisplayValue('Test User');
    await user.clear(nameInput);
    await user.type(nameInput, 'Changed');

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await waitFor(() => expect(cancelButton).toBeEnabled());
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });
  });

  it('renders activity timestamps as read-only', () => {
    renderWithProviders(<AdminUserForm user={mockUser} />);

    const createdAtValue = new Date(mockUser.createdAt).toLocaleString();
    const createdAtInput = screen.getByDisplayValue(createdAtValue);
    expect(createdAtInput).toHaveAttribute('readOnly');

    const updatedAtValue = new Date(mockUser.updatedAt).toLocaleString();
    const updatedAtInput = screen.getByDisplayValue(updatedAtValue);
    expect(updatedAtInput).toHaveAttribute('readOnly');
  });
});
