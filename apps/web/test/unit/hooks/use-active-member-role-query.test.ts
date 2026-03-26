// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import { useActiveMemberRoleQuery } from '@/hooks/use-active-member-role-query';

const { getActiveMemberRoleMock } = vi.hoisted(() => ({
  getActiveMemberRoleMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      getActiveMemberRole: getActiveMemberRoleMock,
    },
  },
}));

describe('useActiveMemberRoleQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns role when fetch succeeds', async () => {
    getActiveMemberRoleMock.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    });

    const { result } = renderHook(() => useActiveMemberRoleQuery('ws-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBe('owner');
    });
  });

  it('returns null when fetch errors', async () => {
    getActiveMemberRoleMock.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' },
    });

    const { result } = renderHook(() => useActiveMemberRoleQuery('ws-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it('does not fetch when workspaceId is null', () => {
    getActiveMemberRoleMock.mockResolvedValue({
      data: { role: 'owner' },
      error: null,
    });

    renderHook(() => useActiveMemberRoleQuery(null), {
      wrapper: createHookWrapper(),
    });

    expect(getActiveMemberRoleMock).not.toHaveBeenCalled();
  });
});
