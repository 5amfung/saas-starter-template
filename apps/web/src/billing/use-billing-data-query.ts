import { useQuery } from '@tanstack/react-query';
import { getWorkspaceBillingData } from '@/billing/billing.functions';

export const BILLING_DATA_QUERY_KEY = (workspaceId: string) =>
  ['billing', 'data', workspaceId] as const;

export function useBillingDataQuery(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: BILLING_DATA_QUERY_KEY(workspaceId),
    queryFn: () => getWorkspaceBillingData({ data: { workspaceId } }),
    enabled,
  });
}
