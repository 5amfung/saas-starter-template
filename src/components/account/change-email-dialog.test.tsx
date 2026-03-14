// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { ChangeEmailDialog } from '@/components/account/change-email-dialog';

const { changeEmailMock } = vi.hoisted(() => ({
  changeEmailMock: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: { changeEmail: changeEmailMock },
}));

const CURRENT_EMAIL = 'old@example.com';

const openDialog = async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChangeEmailDialog currentEmail={CURRENT_EMAIL} />);
  await user.click(screen.getByRole('button', { name: /change email/i }));
  return user;
};

describe('ChangeEmailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens dialog with email input and confirmation field', async () => {
    await openDialog();

    expect(screen.getByLabelText(/new email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('CHANGE')).toBeInTheDocument();
  });

  it('keeps submit disabled until valid email AND CHANGE confirmation are both provided', async () => {
    const user = await openDialog();

    const submitButton = screen
      .getAllByRole('button', { name: /change email/i })
      .find((btn) => btn.getAttribute('data-slot') === 'alert-dialog-action')!;

    // Initially disabled.
    expect(submitButton).toBeDisabled();

    // Type valid email but no confirmation.
    await user.type(
      screen.getByLabelText(/new email address/i),
      'new@example.com',
    );
    expect(submitButton).toBeDisabled();

    // Type confirmation but clear email.
    await user.clear(screen.getByLabelText(/new email address/i));
    await user.type(screen.getByPlaceholderText('CHANGE'), 'CHANGE');
    expect(submitButton).toBeDisabled();

    // Provide both valid email and correct confirmation.
    await user.type(
      screen.getByLabelText(/new email address/i),
      'new@example.com',
    );
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows error when new email matches current email', async () => {
    const user = await openDialog();

    await user.type(screen.getByLabelText(/new email address/i), CURRENT_EMAIL);

    await waitFor(() => {
      expect(
        screen.getByText(/new email must differ from current/i),
      ).toBeInTheDocument();
    });
  });

  it('calls changeEmail on valid submit', async () => {
    changeEmailMock.mockResolvedValue({ error: null });
    const user = await openDialog();

    await user.type(
      screen.getByLabelText(/new email address/i),
      'new@example.com',
    );
    await user.type(screen.getByPlaceholderText('CHANGE'), 'CHANGE');

    const submitButton = screen
      .getAllByRole('button', { name: /change email/i })
      .find((btn) => btn.getAttribute('data-slot') === 'alert-dialog-action')!;

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(changeEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          newEmail: 'new@example.com',
        }),
      );
    });
  });
});
