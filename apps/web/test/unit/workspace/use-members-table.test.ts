// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  createHookWrapper,
  createMockSessionResponse,
} from '@workspace/test-utils';
import { useMembersTable } from '@/workspace/use-members-table';

const {
  listMembersMock,
  leaveMock,
  removeMemberMock,
  navigateMock,
  mockToastSuccess,
  mockToastError,
  useSessionQueryMock,
  useActiveMemberRoleQueryMock,
} = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  leaveMock: vi.fn(),
  removeMemberMock: vi.fn(),
  navigateMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  useSessionQueryMock: vi.fn(),
  useActiveMemberRoleQueryMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      listMembers: listMembersMock,
      leave: leaveMock,
      removeMember: removeMemberMock,
    },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

vi.mock('@/hooks/use-session-query', () => ({
  useSessionQuery: useSessionQueryMock,
}));

vi.mock('@/hooks/use-active-member-role-query', () => ({
  useActiveMemberRoleQuery: useActiveMemberRoleQueryMock,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const WORKSPACE_ID = 'ws-1';
const mockSession = createMockSessionResponse();

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
  useActiveMemberRoleQueryMock.mockReturnValue({ data: 'owner' });
}

describe('useMembersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  describe('query & data', () => {
    it('fetches members and maps to WorkspaceMemberRow shape', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

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
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      expect(result.current.currentUserId).toBe(mockSession.user.id);
    });

    it('fetches current user role', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.currentUserRole).toBe('owner');
      });
    });
  });

  describe('pagination', () => {
    it('resets page to 1 when pageSize changes', () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

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
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.onPageChange(3);
      });
      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });
      expect(result.current.page).toBe(1);
    });

    it('does not forward email sorting to the members API', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

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

      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

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
    it('calls organization.leave with organizationId', async () => {
      leaveMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onLeave();
      });

      expect(leaveMock).toHaveBeenCalledWith({ organizationId: WORKSPACE_ID });
    });

    it('on success: shows toast and navigates to /ws', async () => {
      leaveMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onLeave();
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'You have left the workspace.'
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/ws' });
    });

    it('on error: shows error toast', async () => {
      leaveMock.mockResolvedValueOnce({ error: { message: 'Cannot leave' } });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

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
      removeMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onRemoveMember('mem-2');
      });

      expect(removeMemberMock).toHaveBeenCalledWith({
        memberIdOrEmail: 'mem-2',
        organizationId: WORKSPACE_ID,
      });
    });

    it('on success: shows toast and refetches', async () => {
      removeMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onRemoveMember('mem-2');
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Membership removed.');
    });

    it('on error: shows error toast', async () => {
      removeMemberMock.mockResolvedValueOnce({
        error: { message: 'Forbidden' },
      });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        try {
          await result.current.onRemoveMember('mem-2');
        } catch {}
      });

      expect(mockToastError).toHaveBeenCalled();
    });

    it('tracks removingMemberId during mutation', async () => {
      // Create a deferred promise so we can inspect state mid-mutation.
      let resolve: () => void;
      removeMemberMock.mockReturnValueOnce(
        new Promise<{ error: null }>((r) => {
          resolve = () => r({ error: null });
        })
      );
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      expect(result.current.removingMemberId).toBeNull();

      // Start the mutation without awaiting it.
      let mutationPromise: Promise<void>;
      act(() => {
        mutationPromise = result.current.onRemoveMember('mem-2');
      });

      // Mid-mutation: removingMemberId should be set.
      await waitFor(() => {
        expect(result.current.removingMemberId).toBe('mem-2');
      });

      // Resolve the mutation.
      await act(async () => {
        resolve!();
        await mutationPromise;
      });

      // After mutation: removingMemberId should be cleared.
      expect(result.current.removingMemberId).toBeNull();
    });
  });
});
