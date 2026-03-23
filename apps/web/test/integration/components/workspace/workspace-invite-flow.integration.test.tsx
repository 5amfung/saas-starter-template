// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import type { InviteRole } from '@/workspace/workspace-members.types';
import { WorkspaceInviteDialog } from '@/components/workspace/workspace-invite-dialog';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  email: '',
  role: 'member' as InviteRole,
  roles: ['member', 'admin'] as const,
  isPending: false,
  onEmailChange: vi.fn(),
  onRoleChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe('WorkspaceInviteDialog integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with email input and role select', () => {
    renderWithProviders(<WorkspaceInviteDialog {...defaultProps} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('calls onEmailChange when user types email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceInviteDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');

    expect(defaultProps.onEmailChange).toHaveBeenCalled();
  });

  it('calls onSubmit when Send Invitation is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceInviteDialog {...defaultProps} email="test@example.com" />
    );

    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isPending is true', () => {
    renderWithProviders(
      <WorkspaceInviteDialog {...defaultProps} isPending={true} />
    );

    expect(
      screen.getByRole('button', { name: /send invitation/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('calls onOpenChange when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceInviteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalled();
  });
});
