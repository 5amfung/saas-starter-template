// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMockMemberRow,
  renderWithProviders,
} from '@workspace/test-utils';
import { WorkspaceMembersTable } from '@/components/workspace/workspace-members-table';

const defaultProps = {
  data: [
    createMockMemberRow({
      id: 'mem-1',
      userId: 'user-1',
      email: 'owner@test.com',
      role: 'owner',
    }),
    createMockMemberRow({
      id: 'mem-2',
      userId: 'user-2',
      email: 'member@test.com',
      role: 'member',
    }),
  ],
  total: 2,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  sorting: [],
  isLoading: false,
  removingMemberId: null,
  leavingWorkspace: false,
  currentUserId: 'user-1',
  workspaceRole: 'owner',
  canLeaveWorkspace: false,
  canManageMembers: true,
  onSortingChange: vi.fn(),
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  onRemoveMember: vi.fn(),
  onLeave: vi.fn(),
};

describe('WorkspaceMembersTable integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders member list from data', () => {
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);
    expect(screen.getByText('owner@test.com')).toBeInTheDocument();
    expect(screen.getByText('member@test.com')).toBeInTheDocument();
  });

  it('shows Remove option for non-owner members when user is owner', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    // Second row (member@test.com) should have Remove.
    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    expect(removeItem).not.toBeDisabled();
  });

  it('requires REMOVE confirmation before calling onRemoveMember', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    await user.click(removeItem);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(defaultProps.onRemoveMember).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole('button', {
      name: /confirm remove/i,
    });
    expect(confirmButton).toBeDisabled();

    const confirmationInput = screen.getByPlaceholderText('REMOVE');
    await user.type(confirmationInput, 'REMOV');
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(defaultProps.onRemoveMember).not.toHaveBeenCalled();

    await user.type(confirmationInput, 'E');
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);

    expect(defaultProps.onRemoveMember).toHaveBeenCalledWith('mem-2');
  });

  it('shows Leave option for current user row', async () => {
    const user = userEvent.setup();
    // Use user-2 (member role) as current user so isOwnerRow=false and isCurrentUserRow=true => shows Leave.
    renderWithProviders(
      <WorkspaceMembersTable
        {...defaultProps}
        currentUserId="user-2"
        workspaceRole="member"
        canLeaveWorkspace={true}
        canManageMembers={false}
      />
    );

    // Second row (user-2 = currentUserId) should show Leave.
    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    expect(leaveItem).toBeInTheDocument();
  });

  it('requires LEAVE confirmation before calling onLeave', async () => {
    const user = userEvent.setup();
    // Use user-2 (member role) as current user so isOwnerRow=false and isCurrentUserRow=true => shows Leave.
    renderWithProviders(
      <WorkspaceMembersTable
        {...defaultProps}
        currentUserId="user-2"
        workspaceRole="member"
        canLeaveWorkspace={true}
        canManageMembers={false}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    await user.click(leaveItem);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(defaultProps.onLeave).not.toHaveBeenCalled();

    const confirmButton = screen.getByRole('button', {
      name: /confirm leave/i,
    });
    expect(confirmButton).toBeDisabled();

    const confirmationInput = screen.getByPlaceholderText('LEAVE');
    await user.type(confirmationInput, 'LEAV');
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(defaultProps.onLeave).not.toHaveBeenCalled();

    await user.type(confirmationInput, 'E');
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);

    expect(defaultProps.onLeave).toHaveBeenCalledTimes(1);
  });

  it('clears the pending action when the confirm dialog is dismissed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    await user.click(await screen.findByRole('menuitem', { name: /remove/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows skeleton rows when isLoading is true', () => {
    renderWithProviders(
      <WorkspaceMembersTable {...defaultProps} data={[]} isLoading={true} />
    );

    expect(screen.queryByText('owner@test.com')).not.toBeInTheDocument();
    // Skeleton rows should be present (no "No team members found" message).
    expect(
      screen.queryByText(/no team members found/i)
    ).not.toBeInTheDocument();
  });

  it('disables remove button when removingMemberId matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceMembersTable {...defaultProps} removingMemberId="mem-2" />
    );

    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    expect(removeItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables leave option when leavingWorkspace is true', async () => {
    const user = userEvent.setup();
    // Use user-2 (member role) as current user so isOwnerRow=false and isCurrentUserRow=true => shows Leave.
    renderWithProviders(
      <WorkspaceMembersTable
        {...defaultProps}
        currentUserId="user-2"
        workspaceRole="member"
        canManageMembers={false}
        leavingWorkspace={true}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /row actions for member@test\.com/i,
      })
    );

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    expect(leaveItem).toHaveAttribute('aria-disabled', 'true');
  });
});
