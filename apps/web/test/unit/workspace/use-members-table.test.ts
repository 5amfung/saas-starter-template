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
} from '@/workspace/workspace-members.functions';

const {
  listMembersMock,
  navigateMock,
  mockToastSuccess,
  mockToastError,
  useSessionQueryMock,
} = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  navigateMock: vi.fn(),
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
}));

vi.mock('@workspace/components/hooks', () => ({
  useSessionQuery: useSessionQueryMock,
}));

vi.mock('@/workspace/workspace-members.functions', () => ({
  leaveWorkspace: vi.fn(),
  removeWorkspaceMember: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const WORKSPACE_ID = 'ws-1';
const mockSession = createMockSessionResponse();
const leaveWorkspaceMock = vi.mocked(leaveWorkspace);
const removeWorkspaceMemberMock = vi.mocked(removeWorkspaceMember);
type LeaveWorkspaceResult = Awaited<ReturnType<typeof leaveWorkspace>>;
type RemoveWorkspaceMemberResult = Awaited<
  ReturnType<typeof removeWorkspaceMember>
>;
const mockLeaveWorkspaceResult = {} as LeaveWorkspaceResult;
const mockRemoveWorkspaceMemberResult = {} as RemoveWorkspaceMemberResult;

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
  listMembersMock.mockResolvedValue(mockMembersResponse);
}

function renderMembersTableHook(
  role: string | null = 'owner',
  canLeaveWorkspace = true
) {
  return renderHook(() => useMembersTable(WORKSPACE_ID, role, canLeaveWorkspace), {
    wrapper: createHookWrapper(),
  });
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
});
