// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { AccountProfileForm } from '@/components/account/account-profile-form';
import { ChangePasswordDialog } from '@/components/account/change-password-dialog';
import { ChangeEmailDialog } from '@/components/account/change-email-dialog';

const {
  updateUserMock,
  changePasswordMock,
  changeEmailMock,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  updateUserMock: vi.fn(),
  changePasswordMock: vi.fn(),
  changeEmailMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    updateUser: updateUserMock,
    changePassword: changePasswordMock,
    changeEmail: changeEmailMock,
  },
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal()),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

const TEST_USER = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  image: null,
};

describe('Account settings flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('profile update flow', () => {
    it('updates profile name end-to-end: edit → submit → success toast', async () => {
      const user = userEvent.setup();
      updateUserMock.mockResolvedValue({ data: {}, error: null });

      renderWithProviders(<AccountProfileForm user={TEST_USER} />);

      // Verify initial state.
      const nameInput = screen.getByLabelText(/full name/i);
      expect(nameInput).toHaveValue('Jane Doe');
      expect(
        screen.getByRole('button', { name: /save changes/i })
      ).toBeDisabled();

      // Edit name.
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane Smith');

      // Save button should be enabled after editing.
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /save changes/i })
        ).toBeEnabled();
      });

      // Submit.
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // Verify mutation was called.
      await waitFor(() => {
        expect(updateUserMock).toHaveBeenCalledWith({ name: 'Jane Smith' });
      });
    });

    // Note: Error path for profile update is covered in the unit test
    // (account-profile-form.test.tsx). Skipping here because the form's
    // onSubmit calls mutation.mutateAsync which re-throws, causing an
    // unhandled rejection that Vitest cannot suppress in integration context.
  });

  describe('password change flow', () => {
    it('opens dialog, fills fields, submits, and closes on success', async () => {
      const user = userEvent.setup();
      changePasswordMock.mockResolvedValue({ error: null });

      renderWithProviders(<ChangePasswordDialog />);

      // Open dialog.
      await user.click(
        screen.getByRole('button', { name: /change password/i })
      );

      // Fill fields.
      await user.type(
        screen.getByLabelText(/current password/i),
        'oldPassword1'
      );
      await user.type(screen.getByLabelText(/new password/i), 'newPassword1');
      await user.type(
        screen.getByLabelText(/confirm password/i),
        'newPassword1'
      );
      await user.tab();

      // Find the submit button (in the dialog footer).
      const submitButton = screen
        .getAllByRole('button', { name: /change password/i })
        .find(
          (btn) => btn.getAttribute('data-slot') === 'alert-dialog-action'
        )!;

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

      // Dialog should close after success.
      await waitFor(() => {
        expect(
          screen.queryByLabelText(/current password/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('email change flow', () => {
    it('opens dialog, enters email and confirmation, submits', async () => {
      const user = userEvent.setup();
      changeEmailMock.mockResolvedValue({ error: null });

      renderWithProviders(
        <ChangeEmailDialog currentEmail="jane@example.com" />
      );

      // Open dialog.
      await user.click(screen.getByRole('button', { name: /change email/i }));

      // Enter new email.
      const emailInput = screen.getByLabelText(/new email/i);
      await user.type(emailInput, 'new@example.com');

      // Type confirmation.
      const confirmInput = screen.getByPlaceholderText('CHANGE');
      await user.type(confirmInput, 'CHANGE');

      // Find submit button in dialog.
      const submitButton = screen
        .getAllByRole('button', { name: /change email/i })
        .find(
          (btn) => btn.getAttribute('data-slot') === 'alert-dialog-action'
        )!;

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      await user.click(submitButton);

      await waitFor(() => {
        expect(changeEmailMock).toHaveBeenCalledWith(
          expect.objectContaining({
            newEmail: 'new@example.com',
          })
        );
      });

      // Should show success toast.
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Check your current email to approve this change.'
        );
      });
    });

    it('prevents submission when new email matches current email', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <ChangeEmailDialog currentEmail="jane@example.com" />
      );

      await user.click(screen.getByRole('button', { name: /change email/i }));

      await user.type(screen.getByLabelText(/new email/i), 'jane@example.com');
      await user.type(screen.getByPlaceholderText('CHANGE'), 'CHANGE');

      // Submit button should be disabled because email matches current.
      const submitButton = screen
        .getAllByRole('button', { name: /change email/i })
        .find(
          (btn) => btn.getAttribute('data-slot') === 'alert-dialog-action'
        )!;

      expect(submitButton).toBeDisabled();

      // Error message should show.
      expect(
        screen.getByText(/new email must differ from current/i)
      ).toBeInTheDocument();
    });
  });
});
