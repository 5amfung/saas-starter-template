// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { AccountProfileForm } from '@/components/account/account-profile-form';

const { updateUser } = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    updateUser,
  },
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

describe('AccountProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user name in input field', () => {
    renderWithProviders(<AccountProfileForm user={TEST_USER} />);
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Doe');
  });

  it('disables save button when form is clean (unchanged)', () => {
    renderWithProviders(<AccountProfileForm user={TEST_USER} />);
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeDisabled();
  });

  it('enables save button after editing name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountProfileForm user={TEST_USER} />);

    const input = screen.getByLabelText(/full name/i);
    await user.clear(input);
    await user.type(input, 'John Doe');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /save changes/i })
      ).toBeEnabled();
    });
  });

  it('calls updateUser on submit with updated name', async () => {
    const user = userEvent.setup();
    updateUser.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<AccountProfileForm user={TEST_USER} />);

    const input = screen.getByLabelText(/full name/i);
    await user.clear(input);
    await user.type(input, 'John Doe');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ name: 'John Doe' });
    });
  });

  it('shows validation error for empty name after blur', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountProfileForm user={TEST_USER} />);

    const input = screen.getByLabelText(/full name/i);
    await user.tripleClick(input);
    await user.clear(input);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it('reverts changes on cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountProfileForm user={TEST_USER} />);

    const input = screen.getByLabelText(/full name/i);
    await user.clear(input);
    await user.type(input, 'John Doe');

    await waitFor(() => {
      expect(input).toHaveValue('John Doe');
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(input).toHaveValue('Jane Doe');
    });
  });
});
