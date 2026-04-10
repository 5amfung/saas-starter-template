import { APIError } from 'better-auth/api';
import { WORKSPACE_OPERATIONS } from '@workspace/logging/operations';
import { createServerFnMock } from '../../mocks/server-fn';
import {
  inviteWorkspaceMember,
  leaveWorkspace,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
} from '@/workspace/workspace-members.functions';

const {
  loggerMock,
  getAuthMock,
  getDbMock,
  getSessionMock,
  getRequestHeadersMock,
  requireWorkspaceCapabilityForUserMock,
  requireWorkspaceLeaveAllowedForUserMock,
  requireWorkspaceMemberRemovalAllowedForUserMock,
  requireWorkspaceOwnershipTransferAllowedForUserMock,
  getWorkspaceMemberByIdMock,
  getWorkspaceMemberForUserMock,
  createInvitationMock,
  removeMemberMock,
  leaveOrganizationMock,
} = vi.hoisted(() => ({
  loggerMock: vi.fn(),
  getAuthMock: vi.fn(),
  getDbMock: vi.fn(),
  getSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  requireWorkspaceCapabilityForUserMock: vi.fn(),
  requireWorkspaceLeaveAllowedForUserMock: vi.fn(),
  requireWorkspaceMemberRemovalAllowedForUserMock: vi.fn(),
  requireWorkspaceOwnershipTransferAllowedForUserMock: vi.fn(),
  getWorkspaceMemberByIdMock: vi.fn(),
  getWorkspaceMemberForUserMock: vi.fn(),
  createInvitationMock: vi.fn(),
  removeMemberMock: vi.fn(),
  leaveOrganizationMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/init', () => ({
  getAuth: getAuthMock,
  getDb: getDbMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: loggerMock,
}));

vi.mock('@/policy/workspace-capabilities.server', () => ({
  requireWorkspaceCapabilityForUser: requireWorkspaceCapabilityForUserMock,
}));

vi.mock('@/policy/workspace-lifecycle-capabilities.server', () => ({
  requireWorkspaceLeaveAllowedForUser: requireWorkspaceLeaveAllowedForUserMock,
  requireWorkspaceMemberRemovalAllowedForUser:
    requireWorkspaceMemberRemovalAllowedForUserMock,
  requireWorkspaceOwnershipTransferAllowedForUser:
    requireWorkspaceOwnershipTransferAllowedForUserMock,
}));

vi.mock('@/workspace/workspace.server', () => ({
  getWorkspaceMemberById: getWorkspaceMemberByIdMock,
  getWorkspaceMemberForUser: getWorkspaceMemberForUserMock,
}));

function createTransactionHarness(options: {
  executeResults?: Array<{ rows: Array<{ id: string; role: string }> } | Error>;
}) {
  const tx = {
    execute: vi.fn(() => {
      const next = options.executeResults?.shift();
      if (next instanceof Error) {
        throw next;
      }

      return next ?? { rows: [] };
    }),
  };

  const transactionMock = vi.fn((callback: (tx: unknown) => unknown) =>
    callback(tx)
  );

  getDbMock.mockReturnValue({
    transaction: transactionMock,
  });

  return {
    transactionMock,
    tx,
  };
}

describe('workspace-members.functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthMock.mockReturnValue({
      api: {
        getSession: getSessionMock,
        createInvitation: createInvitationMock,
        removeMember: removeMemberMock,
        leaveOrganization: leaveOrganizationMock,
      },
    });
  });

  it('logs workspace invitation events on success', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: 'user-1', emailVerified: true },
    });
    requireWorkspaceCapabilityForUserMock.mockResolvedValueOnce(undefined);
    createInvitationMock.mockResolvedValueOnce({ id: 'inv-1' });

    await expect(
      inviteWorkspaceMember({
        data: {
          workspaceId: 'ws-1',
          email: 'jane@example.com',
          role: 'admin',
        },
      })
    ).resolves.toEqual({ id: 'inv-1' });

    expect(loggerMock).toHaveBeenCalledWith(
      'info',
      'workspace member invited',
      expect.objectContaining({
        operation: WORKSPACE_OPERATIONS.memberInvited,
        workspaceId: 'ws-1',
        userId: 'user-1',
        email: 'jane@example.com',
        role: 'admin',
        resend: false,
      })
    );
  });

  it('logs workspace member removals on success', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: 'user-1', emailVerified: true },
    });
    requireWorkspaceCapabilityForUserMock.mockResolvedValueOnce(undefined);
    requireWorkspaceMemberRemovalAllowedForUserMock.mockResolvedValueOnce(
      undefined
    );
    removeMemberMock.mockResolvedValueOnce({ success: true });

    await expect(
      removeWorkspaceMember({
        data: {
          workspaceId: 'ws-1',
          memberId: 'member-2',
        },
      })
    ).resolves.toEqual({ success: true });

    expect(loggerMock).toHaveBeenCalledWith(
      'info',
      'workspace member removed',
      expect.objectContaining({
        operation: WORKSPACE_OPERATIONS.memberRemoved,
        workspaceId: 'ws-1',
        userId: 'user-1',
        memberId: 'member-2',
      })
    );
  });

  it('logs workspace leave events on success', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: 'user-1', emailVerified: true },
    });
    requireWorkspaceLeaveAllowedForUserMock.mockResolvedValueOnce(undefined);
    leaveOrganizationMock.mockResolvedValueOnce({ success: true });

    await expect(
      leaveWorkspace({
        data: {
          workspaceId: 'ws-1',
        },
      })
    ).resolves.toEqual({ success: true });

    expect(loggerMock).toHaveBeenCalledWith(
      'info',
      'workspace member left',
      expect.objectContaining({
        operation: WORKSPACE_OPERATIONS.memberRemoved,
        workspaceId: 'ws-1',
        userId: 'user-1',
      })
    );
  });

  it('transfers ownership inside a single database transaction', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: 'user-1', emailVerified: true },
    });
    requireWorkspaceOwnershipTransferAllowedForUserMock.mockResolvedValueOnce(
      undefined
    );
    getWorkspaceMemberForUserMock.mockResolvedValueOnce({
      id: 'member-owner',
      userId: 'user-1',
      role: 'owner',
    });
    getWorkspaceMemberByIdMock.mockResolvedValueOnce({
      id: 'member-target',
      userId: 'user-2',
      role: 'admin',
    });
    const { transactionMock, tx } = createTransactionHarness({
      executeResults: [
        { rows: [{ id: 'member-target', role: 'owner' }] },
        { rows: [{ id: 'member-owner', role: 'admin' }] },
        {
          rows: [
            { id: 'member-owner', role: 'admin' },
            { id: 'member-target', role: 'owner' },
            { id: 'member-third', role: 'member' },
          ],
        },
      ],
    });

    await expect(
      transferWorkspaceOwnership({
        data: { workspaceId: 'ws-1', memberId: 'member-target' },
      })
    ).resolves.toEqual({
      workspaceId: 'ws-1',
      memberId: 'member-target',
    });

    expect(
      requireWorkspaceOwnershipTransferAllowedForUserMock
    ).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      'user-1',
      'member-target'
    );
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(tx.execute).toHaveBeenCalledTimes(3);
    expect(loggerMock).toHaveBeenCalledWith(
      'info',
      'workspace ownership transferred',
      expect.objectContaining({
        operation: WORKSPACE_OPERATIONS.ownershipTransferred,
        workspaceId: 'ws-1',
        userId: 'user-1',
        memberId: 'member-target',
      })
    );
  });

  it('throws when the ownership promotion update cannot start', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: 'user-1', emailVerified: true },
    });
    requireWorkspaceOwnershipTransferAllowedForUserMock.mockResolvedValueOnce(
      undefined
    );
    getWorkspaceMemberForUserMock.mockResolvedValueOnce({
      id: 'member-owner',
      userId: 'user-1',
      role: 'owner',
    });
    getWorkspaceMemberByIdMock.mockResolvedValueOnce({
      id: 'member-target',
      userId: 'user-2',
      role: 'admin',
    });
    createTransactionHarness({
      executeResults: [
        { rows: [] },
        { rows: [{ id: 'member-owner', role: 'admin' }] },
      ],
    });

    await expect(
      transferWorkspaceOwnership({
        data: { workspaceId: 'ws-1', memberId: 'member-target' },
      })
    ).rejects.toMatchObject({
      message: 'Workspace ownership transfer could not be started.',
    });
  });

  it('throws when the actor demotion update cannot complete', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: 'user-1', emailVerified: true },
    });
    requireWorkspaceOwnershipTransferAllowedForUserMock.mockResolvedValueOnce(
      undefined
    );
    getWorkspaceMemberForUserMock.mockResolvedValueOnce({
      id: 'member-owner',
      userId: 'user-1',
      role: 'owner',
    });
    getWorkspaceMemberByIdMock.mockResolvedValueOnce({
      id: 'member-target',
      userId: 'user-2',
      role: 'admin',
    });
    createTransactionHarness({
      executeResults: [
        { rows: [{ id: 'member-target', role: 'owner' }] },
        { rows: [] },
      ],
    });

    await expect(
      transferWorkspaceOwnership({
        data: { workspaceId: 'ws-1', memberId: 'member-target' },
      })
    ).rejects.toMatchObject({
      message: 'Workspace ownership transfer could not be completed.',
    });
  });

  it('throws when the post-transaction ownership invariant is broken', async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: 'user-1', emailVerified: true },
    });
    requireWorkspaceOwnershipTransferAllowedForUserMock.mockResolvedValueOnce(
      undefined
    );
    getWorkspaceMemberForUserMock.mockResolvedValueOnce({
      id: 'member-owner',
      userId: 'user-1',
      role: 'owner',
    });
    getWorkspaceMemberByIdMock.mockResolvedValueOnce({
      id: 'member-target',
      userId: 'user-2',
      role: 'admin',
    });
    createTransactionHarness({
      executeResults: [
        { rows: [{ id: 'member-target', role: 'owner' }] },
        { rows: [{ id: 'member-owner', role: 'admin' }] },
        {
          rows: [
            { id: 'member-owner', role: 'owner' },
            { id: 'member-target', role: 'owner' },
          ],
        },
      ],
    });

    await expect(
      transferWorkspaceOwnership({
        data: { workspaceId: 'ws-1', memberId: 'member-target' },
      })
    ).rejects.toBeInstanceOf(APIError);
  });
});
