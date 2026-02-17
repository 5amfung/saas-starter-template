import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/auth/auth-client';

export const SESSIONS_QUERY_KEY = ['user_active_sessions'] as const;

export function useSessionsQuery() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
