import { useQuery } from '@tanstack/react-query';
import { getWebAppEntry } from './web-app-entry.functions';

export const WEB_APP_ENTRY_QUERY_KEY = ['web-app', 'entry'] as const;

export function useWebAppEntryQuery(enabled = true) {
  return useQuery({
    queryKey: WEB_APP_ENTRY_QUERY_KEY,
    queryFn: () => getWebAppEntry(),
    enabled,
  });
}

export function useWebAppEntry(enabled = true) {
  return useWebAppEntryQuery(enabled);
}
