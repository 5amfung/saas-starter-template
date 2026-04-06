import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { WebAppEntry } from '@/policy/web-app-entry.shared';
import { getWebAppEntryRedirectTarget } from '@/policy/web-app-entry.shared';
import { getCurrentWebAppEntry } from '@/policy/web-app-entry.server';

export function getIndexRedirectTarget(entry: WebAppEntry) {
  return getWebAppEntryRedirectTarget(entry, 'root');
}

const redirectByAuthStatus = createServerFn().handler(async () => {
  const entry = await getCurrentWebAppEntry();
  throw redirect({ to: getIndexRedirectTarget(entry) });
});

export const Route = createFileRoute('/')({
  beforeLoad: () => redirectByAuthStatus(),
});
