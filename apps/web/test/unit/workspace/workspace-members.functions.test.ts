import { APIError } from 'better-auth/api';
import { createServerFnMock } from '../../mocks/server-fn';
import { transferWorkspaceOwnership } from '@/workspace/workspace-members.functions';

const {
  getAuthMock,
  getDbMock,
  getSessionMock,
  getRequestHeadersMock,
  requireWorkspaceOwnershipTransferAllowedForUserMock,
  getWorkspaceMemberByIdMock,
  getWorkspaceMemberForUserMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getDbMock: vi.fn(),
  getSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  requireWorkspaceOwnershipTransferAllowedForUserMock: vi.fn(),
  getWorkspaceMemberByIdMock: vi.fn(),
  getWorkspaceMemberForUserMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/init.server', () => ({
  getAuth: getAuthMock,
  getDb: getDbMock,
}));

vi.mock('@/policy/workspace-lifecycle-capabilities.server', () => ({
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
      },
    });
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
