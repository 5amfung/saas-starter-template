// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { AdminUserForm } from './admin-user-form';

const { updateUserMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    admin: {
      updateUser: updateUserMock,
    },
  },
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
          userId: 'user-1',
        }),
      );
    });
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

    // Activity fields don't use htmlFor, so query by displayed date values.
    const createdAtValue = new Date(mockUser.createdAt).toLocaleString();
    const createdAtInput = screen.getByDisplayValue(createdAtValue);
    expect(createdAtInput).toHaveAttribute('readOnly');

    const updatedAtValue = new Date(mockUser.updatedAt).toLocaleString();
    const updatedAtInput = screen.getByDisplayValue(updatedAtValue);
    expect(updatedAtInput).toHaveAttribute('readOnly');
  });
});
