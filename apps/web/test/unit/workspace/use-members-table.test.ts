// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  createHookWrapper,
  createMockSessionResponse,
} from '@workspace/test-utils';
import { useMembersTable } from '@/workspace/use-members-table';
import {
  leaveWorkspace,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
} from '@/workspace/workspace-members.functions';

const {
  listMembersMock,
  navigateMock,
  routerInvalidateMock,
  useQueryClientMock,
  useWorkspaceDetailQueryMock,
  mockToastSuccess,
  mockToastError,
  useSessionQueryMock,
} = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  navigateMock: vi.fn(),
  routerInvalidateMock: vi.fn().mockResolvedValue(undefined),
  useQueryClientMock: vi.fn(),
  useWorkspaceDetailQueryMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  useSessionQueryMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      listMembers: listMembersMock,
    },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
  useRouter: () => ({
    invalidate: routerInvalidateMock,
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal()),
  useQueryClient: useQueryClientMock,
}));

vi.mock('@workspace/components/hooks', () => ({
  useSessionQuery: useSessionQueryMock,
}));

vi.mock('@/workspace/workspace.queries', () => ({
  useWorkspaceDetailQuery: useWorkspaceDetailQueryMock,
  WORKSPACE_DETAIL_QUERY_KEY: (workspaceId: string) => [
    'workspace',
    'detail',
    workspaceId,
  ],
  WORKSPACE_LIST_QUERY_KEY: ['workspace', 'list'],
}));

vi.mock('@/workspace/workspace-members.functions', () => ({
  leaveWorkspace: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  transferWorkspaceOwnership: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const WORKSPACE_ID = 'ws-1';
const mockSession = createMockSessionResponse();
const leaveWorkspaceMock = vi.mocked(leaveWorkspace);
const removeWorkspaceMemberMock = vi.mocked(removeWorkspaceMember);
const transferWorkspaceOwnershipMock = vi.mocked(transferWorkspaceOwnership);
type LeaveWorkspaceResult = Awaited<ReturnType<typeof leaveWorkspace>>;
type RemoveWorkspaceMemberResult = Awaited<
  ReturnType<typeof removeWorkspaceMember>
>;
type TransferWorkspaceOwnershipResult = Awaited<
  ReturnType<typeof transferWorkspaceOwnership>
>;
const mockLeaveWorkspaceResult = {} as LeaveWorkspaceResult;
const mockRemoveWorkspaceMemberResult = {} as RemoveWorkspaceMemberResult;
const mockTransferWorkspaceOwnershipResult =
  {} as TransferWorkspaceOwnershipResult;

const mockMembersResponse = {
  data: {
    members: [
      {
        id: 'mem-1',
        userId: 'user-1',
        role: 'owner',
        user: { email: 'owner@example.com' },
      },
      {
        id: 'mem-2',
        userId: 'user-2',
        role: 'member',
        user: { email: 'member@example.com' },
      },
    ],
    total: 2,
  },
  error: null,
};

function setupDefaults() {
  useSessionQueryMock.mockReturnValue({ data: mockSession });
  useQueryClientMock.mockReturnValue({
    invalidateQueries: vi.fn(),
  });
  useWorkspaceDetailQueryMock.mockReturnValue({
    data: { name: 'Acme Workspace' },
  });
  listMembersMock.mockResolvedValue(mockMembersResponse);
}

function renderMembersTableHook(
  role: string | null = 'owner',
  canLeaveWorkspace = true
) {
  return renderHook(
    () => useMembersTable(WORKSPACE_ID, role, canLeaveWorkspace),
    {
      wrapper: createHookWrapper(),
    }
  );
}

describe('useMembersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  describe('query & data', () => {
    it('fetches members and maps to WorkspaceMemberRow shape', async () => {
      const { result } = renderMembersTableHook();

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      expect(result.current.data[0]).toEqual({
        id: 'mem-1',
        userId: 'user-1',
        role: 'owner',
        email: 'owner@example.com',
      });
    });

    it('returns currentUserId from session', () => {
      const { result } = renderMembersTableHook();

      expect(result.current.currentUserId).toBe(mockSession.user.id);
    });

    it('returns the provided current user role', async () => {
      const { result } = renderMembersTableHook();

      await waitFor(() => {
        expect(result.current.currentUserRole).toBe('owner');
      });
    });

    it('returns the provided leave capability', async () => {
      const { result } = renderMembersTableHook('owner', false);

      await waitFor(() => {
        expect(result.current.canLeaveWorkspace).toBe(false);
      });
    });
  });

  describe('pagination', () => {
    it('resets page to 1 when pageSize changes', () => {
      const { result } = renderMembersTableHook();

      act(() => {
        result.current.onPageChange(2);
      });
      expect(result.current.page).toBe(2);

      act(() => {
        result.current.onPageSizeChange(25);
      });
      expect(result.current.page).toBe(1);
    });

    it('resets page to 1 when sorting changes', () => {
      const { result } = renderMembersTableHook();

      act(() => {
        result.current.onPageChange(3);
      });
      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });
      expect(result.current.page).toBe(1);
    });

    it('does not forward email sorting to the members API', async () => {
      const { result } = renderMembersTableHook();

      await waitFor(() => {
        expect(listMembersMock).toHaveBeenCalledTimes(1);
      });

      listMembersMock.mockClear();

      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });

      await waitFor(() => {
        expect(listMembersMock).toHaveBeenCalledTimes(1);
      });

      expect(listMembersMock).toHaveBeenLastCalledWith({
        query: {
          organizationId: WORKSPACE_ID,
          limit: 10,
          offset: 0,
        },
      });
    });

    it('sorts members by email client-side when email sorting is selected', async () => {
      listMembersMock.mockResolvedValue({
        data: {
          members: [
            {
              id: 'mem-z',
              userId: 'user-z',
              role: 'member',
              user: { email: 'zebra@example.com' },
            },
            {
              id: 'mem-a',
              userId: 'user-a',
              role: 'member',
              user: { email: 'alpha@example.com' },
            },
          ],
          total: 2,
        },
        error: null,
      });

      const { result } = renderMembersTableHook();

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      expect(result.current.data.map((member) => member.email)).toEqual([
        'zebra@example.com',
        'alpha@example.com',
      ]);

      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });

      await waitFor(() => {
        expect(result.current.data.map((member) => member.email)).toEqual([
          'alpha@example.com',
          'zebra@example.com',
        ]);
      });
    });
  });

  describe('leave workspace', () => {
    it('calls leaveWorkspace with workspaceId', async () => {
      leaveWorkspaceMock.mockResolvedValueOnce(mockLeaveWorkspaceResult);
      const { result } = renderMembersTableHook();

      await act(async () => {
        await result.current.onLeave();
      });

      expect(leaveWorkspaceMock).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
        },
      });
    });

    it('on success: shows toast and navigates to /ws', async () => {
      leaveWorkspaceMock.mockResolvedValueOnce(mockLeaveWorkspaceResult);
      const { result } = renderMembersTableHook();

      await act(async () => {
        await result.current.onLeave();
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'You have left the workspace.'
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/ws' });
    });

    it('on error: shows error toast', async () => {
      leaveWorkspaceMock.mockRejectedValueOnce(new Error('Cannot leave'));
      const { result } = renderMembersTableHook();

      await act(async () => {
        try {
          await result.current.onLeave();
        } catch {}
      });

      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('remove member', () => {
    it('calls removeMember with memberIdOrEmail and organizationId', async () => {
      removeWorkspaceMemberMock.mockResolvedValueOnce(
        mockRemoveWorkspaceMemberResult
      );
      const { result } = renderMembersTableHook();

      await act(async () => {
        await result.current.onRemoveMember('mem-2');
      });

      expect(removeWorkspaceMemberMock).toHaveBeenCalledWith({
        data: {
          memberId: 'mem-2',
          workspaceId: WORKSPACE_ID,
        },
      });
    });

    it('on success: shows toast and refetches', async () => {
      removeWorkspaceMemberMock.mockResolvedValueOnce(
        mockRemoveWorkspaceMemberResult
      );
      const { result } = renderMembersTableHook();

      await act(async () => {
        await result.current.onRemoveMember('mem-2');
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Membership removed.');
    });

    it('on error: shows error toast', async () => {
      removeWorkspaceMemberMock.mockRejectedValueOnce(new Error('Forbidden'));
      const { result } = renderMembersTableHook();

      await act(async () => {
        try {
          await result.current.onRemoveMember('mem-2');
        } catch {}
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });

    it('tracks removingMemberId during mutation', async () => {
      let resolve: () => void;
      removeWorkspaceMemberMock.mockReturnValueOnce(
        new Promise<RemoveWorkspaceMemberResult>((r) => {
          resolve = () => r(mockRemoveWorkspaceMemberResult);
        })
      );
      const { result } = renderMembersTableHook();

      expect(result.current.removingMemberId).toBeNull();

      let mutationPromise: Promise<void>;
      act(() => {
        mutationPromise = result.current.onRemoveMember('mem-2');
      });

      await waitFor(() => {
        expect(result.current.removingMemberId).toBe('mem-2');
      });

      await act(async () => {
        resolve!();
        await mutationPromise;
      });

      expect(result.current.removingMemberId).toBeNull();
    });
  });

  describe('transfer ownership', () => {
    it('calls transferWorkspaceOwnership with workspaceId and memberId', async () => {
      transferWorkspaceOwnershipMock.mockResolvedValueOnce(
        mockTransferWorkspaceOwnershipResult
      );
      const { result } = renderMembersTableHook();

      await act(async () => {
        await result.current.onTransferOwnership('mem-2');
      });

      expect(transferWorkspaceOwnershipMock).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          memberId: 'mem-2',
        },
      });
    });

    it('shows success toast after ownership transfer', async () => {
      transferWorkspaceOwnershipMock.mockResolvedValueOnce(
        mockTransferWorkspaceOwnershipResult
      );
      const { result } = renderMembersTableHook();

      await act(async () => {
        await result.current.onTransferOwnership('mem-2');
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Workspace ownership transferred successfully.'
      );
    });

    it('invalidates broader workspace state after ownership transfer', async () => {
      transferWorkspaceOwnershipMock.mockResolvedValueOnce(
        mockTransferWorkspaceOwnershipResult
      );
      const queryClient = {
        invalidateQueries: vi.fn(),
      };
      useQueryClientMock.mockReturnValueOnce(queryClient);

      const { result } = renderMembersTableHook();

      await act(async () => {
        await result.current.onTransferOwnership('mem-2');
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['workspace', 'list'],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['workspace', 'detail', WORKSPACE_ID],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['workspace', 'members', WORKSPACE_ID],
      });
      expect(routerInvalidateMock).toHaveBeenCalledWith({
        sync: true,
      });
    });

    it('tracks transferringMemberId during mutation', async () => {
      let resolve: () => void;
      transferWorkspaceOwnershipMock.mockReturnValueOnce(
        new Promise<TransferWorkspaceOwnershipResult>((r) => {
          resolve = () => r(mockTransferWorkspaceOwnershipResult);
        })
      );
      const { result } = renderMembersTableHook();

      expect(result.current.transferringMemberId).toBeNull();

      let mutationPromise: Promise<void>;
      act(() => {
        mutationPromise = result.current.onTransferOwnership('mem-2');
      });

      await waitFor(() => {
        expect(result.current.transferringMemberId).toBe('mem-2');
      });

      await act(async () => {
        resolve!();
        await mutationPromise;
      });

      expect(result.current.transferringMemberId).toBeNull();
    });

    it('shows error toast on failure', async () => {
      transferWorkspaceOwnershipMock.mockRejectedValueOnce(
        new Error('Transfer blocked')
      );
      const { result } = renderMembersTableHook();

      await act(async () => {
        try {
          await result.current.onTransferOwnership('mem-2');
        } catch {}
      });

      expect(mockToastError).toHaveBeenCalledWith('Transfer blocked');
    });
  });
});
