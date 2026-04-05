import { evaluateAdminAppCapabilities } from '@workspace/policy';
import type { AdminAppCapabilities, PlatformRole } from '@workspace/policy';

export interface AdminAppSessionLike {
  user?: {
    emailVerified?: boolean | null;
    role?: string | null;
  } | null;
}

function normalizePlatformRole(
  session: AdminAppSessionLike | null | undefined
): PlatformRole {
  return session?.user?.emailVerified && session.user.role === 'admin'
    ? 'admin'
    : 'user';
}

export function getAdminAppCapabilitiesForSession(
  session: AdminAppSessionLike | null | undefined
): AdminAppCapabilities {
  return evaluateAdminAppCapabilities({
    platformRole: normalizePlatformRole(session),
  });
}
