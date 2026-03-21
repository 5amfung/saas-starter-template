// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHookWrapper } from '@workspace/test-utils';
import { useInvitationsTable } from '@/workspace/use-invitations-table';

const {
  listInvitationsMock,
  inviteMemberMock,
  cancelInvitationMock,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  listInvitationsMock: vi.fn(),
  inviteMemberMock: vi.fn(),
  cancelInvitationMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      listInvitations: listInvitationsMock,
      inviteMember: inviteMemberMock,
      cancelInvitation: cancelInvitationMock,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const WORKSPACE_ID = 'ws-1';

const mockInvitations = [
  {
    id: 'inv-1',
    email: 'a@example.com',
    role: 'member',
    status: 'pending',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'inv-2',
    email: 'b@example.com',
    role: 'admin',
    status: 'pending',
    createdAt: '2026-03-05T00:00:00Z',
  },
  {
    id: 'inv-3',
    email: 'c@example.com',
    role: 'member',
    status: 'accepted',
    createdAt: '2026-03-02T00:00:00Z',
  },
];

function setupQuery(data = mockInvitations) {
  listInvitationsMock.mockResolvedValue({ data, error: null });
}

describe('useInvitationsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query & data', () => {
    it('filters to pending invitations only', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      const emails = result.current.data.map((row) => row.email);
      expect(emails).not.toContain('c@example.com');
    });

    it('maps to WorkspaceInvitationRow shape', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBeGreaterThan(0);
      });

      const row = result.current.data[0];
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('email');
      expect(row).toHaveProperty('role');
      expect(row).toHaveProperty('invitedAt');
    });

    it('returns isLoading true while query is pending', () => {
      listInvitationsMock.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('pagination', () => {
    it('defaults to page 1', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });
      expect(result.current.page).toBe(1);
    });

    it('resets page to 1 when pageSize changes', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
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

    it('resets page to 1 when sorting changes', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.onPageChange(2);
      });
      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });
      expect(result.current.page).toBe(1);
    });

    it('calculates totalPages correctly (minimum 1)', async () => {
      setupQuery([]);
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.totalPages).toBe(1);
    });
  });

  describe('sorting', () => {
    it('sorts by invitedAt descending', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      act(() => {
        result.current.onSortingChange([{ id: 'invitedAt', desc: true }]);
      });

      const dates = result.current.data.map((row) => row.invitedAt);
      expect(new Date(dates[0]).getTime()).toBeGreaterThanOrEqual(
        new Date(dates[1]).getTime()
      );
    });

    it('sorts by email ascending by default sort', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });

      const emails = result.current.data.map((row) => row.email);
      expect(emails).toEqual([...emails].sort());
    });

    it('does not sort when sorting state is empty', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      // Sorting is empty by default — data should be in original order.
      const emailsBefore = result.current.data.map((row) => row.email);

      act(() => {
        result.current.onSortingChange([]);
      });

      const emailsAfter = result.current.data.map((row) => row.email);
      expect(emailsAfter).toEqual(emailsBefore);
    });
  });

  describe('submitInvite', () => {
    it('shows error toast when email is empty', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith('Email address is required.');
    });

    it('shows error toast for invalid email format', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: 'not-an-email',
          role: 'member',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith(
        'Please enter a valid email address.'
      );
    });

    it('shows error toast when role is not in DEFAULT_INVITE_ROLES', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: 'valid@example.com',
          role: 'superadmin' as any,
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith('Invalid role selected.');
    });

    it('calls inviteMember with lowercase trimmed email', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: '  Test@Example.COM  ',
          role: 'member',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });

      expect(inviteMemberMock).toHaveBeenCalledWith({
        email: 'test@example.com',
        role: 'member',
        organizationId: WORKSPACE_ID,
      });
    });

    it('on success: shows toast, closes dialog, resets draft', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.onOpenChange(true);
        result.current.inviteDialog.setDraft({
          email: 'new@example.com',
          role: 'admin',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Invitation sent.');
      expect(result.current.inviteDialog.open).toBe(false);
      expect(result.current.inviteDialog.draft.email).toBe('');
    });

    it('on mutation error: shows error toast', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({
        error: { message: 'Already invited' },
      });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: 'dup@example.com',
          role: 'member',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith('Already invited');
    });
  });

  describe('removeInvitation', () => {
    it('calls cancelInvitation and shows success toast', async () => {
      setupQuery();
      cancelInvitationMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onRemoveInvitation('inv-1');
      });
      expect(cancelInvitationMock).toHaveBeenCalledWith({
        invitationId: 'inv-1',
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Invitation removed.');
    });

    it('shows error toast on failure', async () => {
      setupQuery();
      cancelInvitationMock.mockResolvedValueOnce({
        error: { message: 'Not found' },
      });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        try {
          await result.current.onRemoveInvitation('inv-99');
        } catch {}
      });
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('resendInvitation', () => {
    it('calls inviteMember with resend: true', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onResendInvitation({
          id: 'inv-1',
          email: 'a@example.com',
          role: 'member',
        });
      });

      expect(inviteMemberMock).toHaveBeenCalledWith({
        email: 'a@example.com',
        role: 'member',
        organizationId: WORKSPACE_ID,
        resend: true,
      });
    });

    it('falls back invalid role to member', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onResendInvitation({
          id: 'inv-1',
          email: 'a@example.com',
          role: 'invalid-role',
        });
      });

      expect(inviteMemberMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member' })
      );
    });

    it('shows success toast on resend', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onResendInvitation({
          id: 'inv-1',
          email: 'a@example.com',
          role: 'member',
        });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Invitation resent.');
    });

    it('shows error toast on resend failure', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({
        error: { message: 'Rate limited' },
      });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        try {
          await result.current.onResendInvitation({
            id: 'inv-1',
            email: 'a@example.com',
            role: 'member',
          });
        } catch {}
      });

      expect(mockToastError).toHaveBeenCalled();
    });
  });
});
