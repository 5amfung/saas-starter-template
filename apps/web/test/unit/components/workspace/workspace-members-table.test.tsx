// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockMemberRow } from '@workspace/test-utils';
import type { SortingState } from '@tanstack/react-table';
import { WorkspaceMembersTable } from '@/components/workspace/workspace-members-table';

const defaultProps = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  sorting: [] as SortingState,
  isLoading: false,
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

describe('WorkspaceMembersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all member rows with emails', () => {
    const members = [
      createMockMemberRow({ id: 'member-1', email: 'alice@example.com' }),
      createMockMemberRow({
        id: 'member-2',
        userId: 'user-2',
        email: 'bob@example.com',
      }),
    ];

    render(
      <WorkspaceMembersTable {...defaultProps} data={members} total={2} />
    );

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('displays role for each member', () => {
    const members = [
      createMockMemberRow({ id: 'member-1', role: 'owner' }),
      createMockMemberRow({ id: 'member-2', userId: 'user-2', role: 'member' }),
    ];

    render(
      <WorkspaceMembersTable {...defaultProps} data={members} total={2} />
    );

    const ownerCells = screen.getAllByText('owner');
    const memberCells = screen.getAllByText('member');
    expect(ownerCells.length).toBeGreaterThan(0);
    expect(memberCells.length).toBeGreaterThan(0);
  });

  it('shows empty state when no members', () => {
    render(<WorkspaceMembersTable {...defaultProps} data={[]} total={0} />);

    expect(screen.getByText('No team members found.')).toBeInTheDocument();
  });

  it('shows skeleton loaders when loading', () => {
    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={[]}
        total={0}
        isLoading={true}
        pageSize={5}
      />
    );

    expect(
      screen.queryByText('No team members found.')
    ).not.toBeInTheDocument();
  });

  it('shows member count', () => {
    const members = [
      createMockMemberRow({ id: 'member-1', email: 'alice@example.com' }),
      createMockMemberRow({
        id: 'member-2',
        userId: 'user-2',
        email: 'bob@example.com',
      }),
    ];

    render(
      <WorkspaceMembersTable {...defaultProps} data={members} total={2} />
    );

    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('shows singular member count for one member', () => {
    const members = [
      createMockMemberRow({ id: 'member-1', email: 'alice@example.com' }),
    ];

    render(
      <WorkspaceMembersTable {...defaultProps} data={members} total={1} />
    );

    expect(screen.getByText('1 member')).toBeInTheDocument();
  });

  it('calls onRemoveMember when remove action is clicked for another member', async () => {
    const user = userEvent.setup();
    const onRemoveMember = vi.fn();
    const members = [
      createMockMemberRow({
        id: 'member-2',
        userId: 'user-2',
        email: 'bob@example.com',
        role: 'member',
      }),
    ];

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={members}
        total={1}
        currentUserId="user-1"
        workspaceRole="owner"
        onRemoveMember={onRemoveMember}
      />
    );

    const triggerButton = screen.getByRole('button', { name: /row actions/i });
    await user.click(triggerButton);

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    await user.click(removeItem);

    expect(onRemoveMember).toHaveBeenCalledWith('member-2');
  });

  it('calls onLeave when current user clicks leave', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    const members = [
      createMockMemberRow({
        id: 'member-1',
        userId: 'user-1',
        email: 'me@example.com',
        role: 'member',
      }),
    ];

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={members}
        total={1}
        currentUserId="user-1"
        workspaceRole="member"
        canLeaveWorkspace={true}
        canManageMembers={false}
        onLeave={onLeave}
      />
    );

    const triggerButton = screen.getByRole('button', { name: /row actions/i });
    await user.click(triggerButton);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    await user.click(leaveItem);

    expect(onLeave).toHaveBeenCalled();
  });

  it('disables next and last pagination buttons on single page', () => {
    const members = [
      createMockMemberRow({ id: 'member-1', email: 'alice@example.com' }),
    ];

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={members}
        total={1}
        page={1}
        totalPages={1}
      />
    );

    const prevButton = screen.getByRole('button', {
      name: /go to previous page/i,
    });
    const nextButton = screen.getByRole('button', { name: /go to next page/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('shows disabled remove for non-managers viewing another member', async () => {
    const user = userEvent.setup();
    const members = [
      createMockMemberRow({
        id: 'member-2',
        userId: 'user-2',
        email: 'bob@example.com',
        role: 'member',
      }),
    ];

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={members}
        total={1}
        currentUserId="user-1"
        workspaceRole="member"
        canLeaveWorkspace={true}
        canManageMembers={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /row actions/i }));

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    expect(removeItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows disabled leave for owner self row', async () => {
    const user = userEvent.setup();
    const members = [
      createMockMemberRow({
        id: 'member-1',
        userId: 'user-1',
        email: 'owner@example.com',
        role: 'owner',
      }),
    ];

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={members}
        total={1}
        currentUserId="user-1"
        workspaceRole="owner"
        canLeaveWorkspace={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /row actions/i }));

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    expect(leaveItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows transfer ownership for eligible rows when viewer is owner', async () => {
    const user = userEvent.setup();
    const members = [
      createMockMemberRow({
        id: 'owner-row',
        userId: 'user-1',
        email: 'owner@example.com',
        role: 'owner',
      }),
      createMockMemberRow({
        id: 'target-row',
        userId: 'user-2',
        email: 'target@example.com',
        role: 'admin',
      }),
    ];

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={members}
        total={2}
        currentUserId="user-1"
        workspaceRole="owner"
      />
    );

    const rowActionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(rowActionButtons[1]);

    expect(
      await screen.findByRole('menuitem', { name: /transfer ownership/i })
    ).toBeInTheDocument();
  });

  it('does not show transfer ownership for self or owner rows', async () => {
    const user = userEvent.setup();
    const members = [
      createMockMemberRow({
        id: 'owner-row',
        userId: 'user-1',
        email: 'owner@example.com',
        role: 'owner',
      }),
      createMockMemberRow({
        id: 'self-admin-row',
        userId: 'user-1',
        email: 'self@example.com',
        role: 'admin',
      }),
    ];

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={members}
        total={2}
        currentUserId="user-1"
        workspaceRole="owner"
      />
    );

    await user.click(
      screen.getAllByRole('button', { name: /row actions/i })[0]
    );
    expect(
      screen.queryByRole('menuitem', { name: /transfer ownership/i })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getAllByRole('button', { name: /row actions/i })[1]
    );
    expect(
      screen.queryByRole('menuitem', { name: /transfer ownership/i })
    ).not.toBeInTheDocument();
  });
});
