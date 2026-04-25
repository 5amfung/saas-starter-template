import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/auth/client/auth-client';

export const LINKED_ACCOUNTS_QUERY_KEY = [
  'account',
  'linked-accounts',
] as const;

export function useLinkedAccountsQuery() {
  return useQuery({
    queryKey: LINKED_ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
