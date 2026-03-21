// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  currentUserRole: 'owner',
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
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('shows Remove option for non-owner members when user is owner', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    // Second row (member@test.com) should have Remove.
    await user.click(actionButtons[1]);

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    expect(removeItem).not.toBeDisabled();
  });

  it('calls onRemoveMember when Remove is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[1]);

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    await user.click(removeItem);

    expect(defaultProps.onRemoveMember).toHaveBeenCalledWith('mem-2');
  });

  it('shows Leave option for current user row', async () => {
    const user = userEvent.setup();
    // Use user-2 (member role) as current user so isOwnerRow=false and isCurrentUserRow=true => shows Leave.
    renderWithProviders(
      <WorkspaceMembersTable
        {...defaultProps}
        currentUserId="user-2"
        currentUserRole="member"
      />
    );

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    // Second row (user-2 = currentUserId) should show Leave.
    await user.click(actionButtons[1]);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    expect(leaveItem).toBeInTheDocument();
  });

  it('calls onLeave when Leave is clicked', async () => {
    const user = userEvent.setup();
    // Use user-2 (member role) as current user so isOwnerRow=false and isCurrentUserRow=true => shows Leave.
    renderWithProviders(
      <WorkspaceMembersTable
        {...defaultProps}
        currentUserId="user-2"
        currentUserRole="member"
      />
    );

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[1]);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    await user.click(leaveItem);

    expect(defaultProps.onLeave).toHaveBeenCalledTimes(1);
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

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[1]);

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
        currentUserRole="member"
        leavingWorkspace={true}
      />
    );

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[1]);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    expect(leaveItem).toHaveAttribute('aria-disabled', 'true');
  });
});
