import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';

export const SESSION_QUERY_KEY = ['current_session'] as const;

export function useSessionQuery() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}
