import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/auth/client/auth-client';

export const ACTIVE_MEMBER_ROLE_QUERY_KEY = (workspaceId: string) =>
  ['workspace', 'activeRole', workspaceId] as const;

export function useActiveMemberRoleQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: ACTIVE_MEMBER_ROLE_QUERY_KEY(workspaceId!),
    queryFn: async () => {
      const { data, error } =
        await authClient.organization.getActiveMemberRole();
      if (error) return null;
      return typeof data.role === 'string' ? data.role : null;
    },
    enabled: !!workspaceId,
  });
}
