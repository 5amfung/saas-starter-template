// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { ChangePasswordDialog } from '@/components/account/change-password-dialog';

const { changePasswordMock } = vi.hoisted(() => ({
  changePasswordMock: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: { changePassword: changePasswordMock },
}));

const openDialog = async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChangePasswordDialog />);
  await user.click(screen.getByRole('button', { name: /change password/i }));
  return user;
};

describe('ChangePasswordDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens dialog with three password fields', async () => {
    await openDialog();

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows validation error for short new password after blur', async () => {
    const user = await openDialog();

    const newPasswordInput = screen.getByLabelText(/new password/i);
    await user.type(newPasswordInput, 'short');
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText(/password must be at least 8 characters/i),
      ).toBeInTheDocument();
    });
  });

  it('shows validation error for mismatched passwords after blur', async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different123');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('calls changePassword with correct params on valid submit', async () => {
    changePasswordMock.mockResolvedValue({ error: null });
    const user = await openDialog();

    await user.type(screen.getByLabelText(/current password/i), 'oldPassword1');
    await user.type(screen.getByLabelText(/new password/i), 'newPassword1');
    await user.type(screen.getByLabelText(/confirm password/i), 'newPassword1');

    // Tab away from the last field to trigger blur validation on all fields.
    // The form-level onBlur validator (Zod schema) runs on each blur. After all fields are
    // filled with valid matching values, the final blur clears all errors and enables the
    // submit button (canSubmit = true).
    await user.tab();

    const submitButton = screen
      .getAllByRole('button', { name: /change password/i })
      .find((btn) => btn.getAttribute('data-slot') === 'alert-dialog-action')!;

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: 'oldPassword1',
        newPassword: 'newPassword1',
        revokeOtherSessions: true,
      });
    });
  });

  it('closes dialog on cancel', async () => {
    const user = await openDialog();

    // Dialog is open — confirm password field is visible.
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText(/current password/i),
      ).not.toBeInTheDocument();
    });
  });
});
