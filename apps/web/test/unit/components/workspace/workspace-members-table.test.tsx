// @vitest-environment jsdom
import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

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

  it('shows the Current user badge exactly once for the signed-in member', () => {
    const members = [
      createMockMemberRow({
        id: 'member-1',
        userId: 'user-1',
        email: 'alice@example.com',
      }),
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

    const currentUserRow = screen.getByText('alice@example.com').closest('tr');
    const otherMemberRow = screen.getByText('bob@example.com').closest('tr');

    expect(currentUserRow).not.toBeNull();
    expect(otherMemberRow).not.toBeNull();

    expect(
      within(currentUserRow as HTMLElement).getByText('Current user')
    ).toBeInTheDocument();
    expect(
      within(otherMemberRow as HTMLElement).queryByText('Current user')
    ).not.toBeInTheDocument();
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

  it('labels each row actions trigger with the member email', () => {
    const members = [
      createMockMemberRow({
        id: 'member-1',
        email: 'alice@example.com',
        role: 'owner',
      }),
      createMockMemberRow({
        id: 'member-2',
        userId: 'user-2',
        email: 'bob@example.com',
        role: 'member',
      }),
    ];

    render(
      <WorkspaceMembersTable {...defaultProps} data={members} total={2} />
    );

    expect(
      screen.getByRole('button', {
        name: /row actions for alice@example\.com/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /row actions for bob@example\.com/i })
    ).toBeInTheDocument();
  });

  it('requires REMOVE confirmation before calling onRemoveMember', async () => {
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

    const triggerButton = screen.getByRole('button', {
      name: /row actions for bob@example\.com/i,
    });
    await user.click(triggerButton);

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    await user.click(removeItem);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onRemoveMember).not.toHaveBeenCalled();

    const confirmationInput = screen.getByPlaceholderText('REMOVE');
    const confirmButton = screen.getByRole('button', {
      name: /confirm remove/i,
    });
    await user.type(confirmationInput, 'REMOV');
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(onRemoveMember).not.toHaveBeenCalled();

    await user.type(confirmationInput, 'E');
    await user.click(screen.getByRole('button', { name: /confirm remove/i }));

    expect(onRemoveMember).toHaveBeenCalledWith('member-2');
  });

  it('requires LEAVE confirmation before calling onLeave', async () => {
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

    const triggerButton = screen.getByRole('button', {
      name: /row actions for me@example\.com/i,
    });
    await user.click(triggerButton);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    await user.click(leaveItem);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onLeave).not.toHaveBeenCalled();

    const confirmationInput = screen.getByPlaceholderText('LEAVE');
    const confirmButton = screen.getByRole('button', {
      name: /confirm leave/i,
    });
    await user.type(confirmationInput, 'LEAV');
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);
    expect(onLeave).not.toHaveBeenCalled();

    await user.type(confirmationInput, 'E');
    await user.click(confirmButton);

    expect(onLeave).toHaveBeenCalled();
  });

  it('keeps REMOVE pending, blocks dismissal, and closes after async confirmation resolves', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<void>();

    function Harness() {
      const [removingMemberId, setRemovingMemberId] = React.useState<
        string | null
      >(null);

      const onRemoveMember = React.useCallback((memberId: string) => {
        setRemovingMemberId(memberId);
        return deferred.promise.finally(() => {
          setRemovingMemberId(null);
        });
      }, []);

      return (
        <WorkspaceMembersTable
          {...defaultProps}
          data={[
            createMockMemberRow({
              id: 'member-2',
              userId: 'user-2',
              email: 'bob@example.com',
              role: 'member',
            }),
          ]}
          total={1}
          currentUserId="user-1"
          workspaceRole="owner"
          removingMemberId={removingMemberId}
          onRemoveMember={onRemoveMember}
        />
      );
    }

    render(<Harness />);

    await user.click(
      screen.getByRole('button', {
        name: /row actions for bob@example\.com/i,
      })
    );
    await user.click(await screen.findByRole('menuitem', { name: /remove/i }));

    const input = screen.getByPlaceholderText('REMOVE');
    const confirmButton = screen.getByRole('button', {
      name: /confirm remove/i,
    });
    await user.type(input, 'REMOVE');
    await user.click(confirmButton);

    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('prevents double remove confirmation clicks before external pending updates', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<void>();
    const onRemoveMember = vi.fn(() => deferred.promise);

    render(
      <WorkspaceMembersTable
        {...defaultProps}
        data={[
          createMockMemberRow({
            id: 'member-2',
            userId: 'user-2',
            email: 'bob@example.com',
            role: 'member',
          }),
        ]}
        total={1}
        currentUserId="user-1"
        workspaceRole="owner"
        onRemoveMember={onRemoveMember}
      />
    );

    await user.click(
      screen.getByRole('button', {
        name: /row actions for bob@example\.com/i,
      })
    );
    await user.click(await screen.findByRole('menuitem', { name: /remove/i }));

    const input = screen.getByPlaceholderText('REMOVE');
    const confirmButton = screen.getByRole('button', {
      name: /confirm remove/i,
    });
    await user.type(input, 'REMOVE');

    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(onRemoveMember).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
  });

  it('keeps REMOVE dialog open when async confirmation rejects', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<void>();

    function Harness() {
      const [removingMemberId, setRemovingMemberId] = React.useState<
        string | null
      >(null);

      const onRemoveMember = React.useCallback((memberId: string) => {
        setRemovingMemberId(memberId);
        return deferred.promise.finally(() => {
          setRemovingMemberId(null);
        });
      }, []);

      return (
        <WorkspaceMembersTable
          {...defaultProps}
          data={[
            createMockMemberRow({
              id: 'member-2',
              userId: 'user-2',
              email: 'bob@example.com',
              role: 'member',
            }),
          ]}
          total={1}
          currentUserId="user-1"
          workspaceRole="owner"
          removingMemberId={removingMemberId}
          onRemoveMember={onRemoveMember}
        />
      );
    }

    render(<Harness />);

    await user.click(
      screen.getByRole('button', {
        name: /row actions for bob@example\.com/i,
      })
    );
    await user.click(await screen.findByRole('menuitem', { name: /remove/i }));

    const input = screen.getByPlaceholderText('REMOVE');
    const confirmButton = screen.getByRole('button', {
      name: /confirm remove/i,
    });
    await user.type(input, 'REMOVE');
    await user.click(confirmButton);

    expect(confirmButton).toBeDisabled();

    await act(async () => {
      deferred.reject(new Error('permission denied'));
      await deferred.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    expect(confirmButton).not.toBeDisabled();
  });

  it('keeps LEAVE open when async confirmation rejects', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<void>();

    function Harness() {
      const [leavingWorkspace, setLeavingWorkspace] = React.useState(false);

      const onLeave = React.useCallback(() => {
        setLeavingWorkspace(true);
        return deferred.promise.finally(() => {
          setLeavingWorkspace(false);
        });
      }, []);

      return (
        <WorkspaceMembersTable
          {...defaultProps}
          data={[
            createMockMemberRow({
              id: 'member-1',
              userId: 'user-1',
              email: 'me@example.com',
              role: 'member',
            }),
          ]}
          total={1}
          currentUserId="user-1"
          workspaceRole="member"
          canLeaveWorkspace={true}
          canManageMembers={false}
          leavingWorkspace={leavingWorkspace}
          onLeave={onLeave}
        />
      );
    }

    render(<Harness />);

    await user.click(
      screen.getByRole('button', {
        name: /row actions for me@example\.com/i,
      })
    );
    await user.click(await screen.findByRole('menuitem', { name: /leave/i }));

    const input = screen.getByPlaceholderText('LEAVE');
    const confirmButton = screen.getByRole('button', {
      name: /confirm leave/i,
    });
    await user.type(input, 'LEAVE');
    await user.click(confirmButton);

    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    await act(async () => {
      deferred.reject(new Error('permission denied'));
      await deferred.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
    expect(confirmButton).not.toBeDisabled();
  });

  it('closes LEAVE dialog after async confirmation resolves', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<void>();

    function Harness() {
      const [leavingWorkspace, setLeavingWorkspace] = React.useState(false);

      const onLeave = React.useCallback(() => {
        setLeavingWorkspace(true);
        return deferred.promise.finally(() => {
          setLeavingWorkspace(false);
        });
      }, []);

      return (
        <WorkspaceMembersTable
          {...defaultProps}
          data={[
            createMockMemberRow({
              id: 'member-1',
              userId: 'user-1',
              email: 'me@example.com',
              role: 'member',
            }),
          ]}
          total={1}
          currentUserId="user-1"
          workspaceRole="member"
          canLeaveWorkspace={true}
          canManageMembers={false}
          leavingWorkspace={leavingWorkspace}
          onLeave={onLeave}
        />
      );
    }

    render(<Harness />);

    await user.click(
      screen.getByRole('button', {
        name: /row actions for me@example\.com/i,
      })
    );
    await user.click(await screen.findByRole('menuitem', { name: /leave/i }));

    const input = screen.getByPlaceholderText('LEAVE');
    const confirmButton = screen.getByRole('button', {
      name: /confirm leave/i,
    });
    await user.type(input, 'LEAVE');
    await user.click(confirmButton);

    expect(confirmButton).toBeDisabled();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
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
