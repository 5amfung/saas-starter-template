import type { PlatformRole } from './admin-app';

export interface SessionEntryFacts {
  hasSession: boolean;
  emailVerified: boolean;
}

export interface WebAppEntryFacts extends SessionEntryFacts {
  activeWorkspaceId: string | null;
  accessibleWorkspaceCount: number;
}

export interface WebAppEntryCapabilities {
  canEnterWebApp: boolean;
  mustSignIn: boolean;
  mustVerifyEmail: boolean;
  mustResolveWorkspace: boolean;
}

export interface AdminAppEntryFacts extends SessionEntryFacts {
  platformRole: PlatformRole | null;
}

export interface AdminAppEntryCapabilities {
  canEnterAdminApp: boolean;
  mustSignIn: boolean;
  mustVerifyEmail: boolean;
  isAdminOnlyDenied: boolean;
}

export function evaluateWebAppEntryCapabilities(
  context: WebAppEntryFacts
): WebAppEntryCapabilities {
  if (!context.hasSession) {
    return {
      canEnterWebApp: false,
      mustSignIn: true,
      mustVerifyEmail: false,
      mustResolveWorkspace: false,
    };
  }

  if (!context.emailVerified) {
    return {
      canEnterWebApp: false,
      mustSignIn: false,
      mustVerifyEmail: true,
      mustResolveWorkspace: false,
    };
  }

  const mustResolveWorkspace =
    context.activeWorkspaceId === null ||
    context.accessibleWorkspaceCount === 0;

  return {
    canEnterWebApp: !mustResolveWorkspace,
    mustSignIn: false,
    mustVerifyEmail: false,
    mustResolveWorkspace,
  };
}

export function evaluateAdminAppEntryCapabilities(
  context: AdminAppEntryFacts
): AdminAppEntryCapabilities {
  if (!context.hasSession) {
    return {
      canEnterAdminApp: false,
      mustSignIn: true,
      mustVerifyEmail: false,
      isAdminOnlyDenied: false,
    };
  }

  if (!context.emailVerified) {
    return {
      canEnterAdminApp: false,
      mustSignIn: false,
      mustVerifyEmail: true,
      isAdminOnlyDenied: false,
    };
  }

  const canEnterAdminApp = context.platformRole === 'admin';

  return {
    canEnterAdminApp,
    mustSignIn: false,
    mustVerifyEmail: false,
    isAdminOnlyDenied: !canEnterAdminApp,
  };
}
