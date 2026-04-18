import { evaluateWebAppEntryCapabilities } from '@workspace/policy';
import type {
  WebAppEntryCapabilities,
  WebAppEntryFacts,
} from '@workspace/policy';

export interface WebAppEntryWorkspace {
  id: string;
}

export interface WebAppEntryResolvedFacts extends WebAppEntryFacts {
  preferredWorkspace: WebAppEntryWorkspace | null;
}

export interface WebAppEntryRedirect {
  kind: 'redirect';
  to: '/signin' | '/verify';
  capabilities: WebAppEntryCapabilities;
}

export interface WebAppEntryBlocked {
  kind: 'blocked';
  reason: 'noAccessibleWorkspaces';
  capabilities: WebAppEntryCapabilities;
}

export interface WebAppEntryNeedsWorkspace {
  kind: 'mustResolveWorkspace';
  preferredWorkspace: WebAppEntryWorkspace;
  capabilities: WebAppEntryCapabilities;
}

export interface WebAppEntryAllowed {
  kind: 'canEnterWebApp';
  activeWorkspaceId: string;
  capabilities: WebAppEntryCapabilities;
}

export type WebAppEntry =
  | WebAppEntryRedirect
  | WebAppEntryBlocked
  | WebAppEntryNeedsWorkspace
  | WebAppEntryAllowed;

export type WebAppEntryRedirectContext = 'root' | 'guest';
export type RootWebAppEntryRedirectTarget = '/signin' | '/verify' | '/ws';
export type GuestWebAppEntryRedirectTarget =
  RootWebAppEntryRedirectTarget | null;

export function resolveWebAppEntry(
  facts: WebAppEntryResolvedFacts
): WebAppEntry {
  const capabilities = evaluateWebAppEntryCapabilities(facts);

  if (capabilities.mustSignIn) {
    return {
      kind: 'redirect',
      to: '/signin',
      capabilities,
    };
  }

  if (capabilities.mustVerifyEmail) {
    return {
      kind: 'redirect',
      to: '/verify',
      capabilities,
    };
  }

  if (capabilities.canEnterWebApp && facts.activeWorkspaceId) {
    return {
      kind: 'canEnterWebApp',
      activeWorkspaceId: facts.activeWorkspaceId,
      capabilities,
    };
  }

  if (facts.preferredWorkspace) {
    return {
      kind: 'mustResolveWorkspace',
      preferredWorkspace: facts.preferredWorkspace,
      capabilities,
    };
  }

  return {
    kind: 'blocked',
    reason: 'noAccessibleWorkspaces',
    capabilities,
  };
}

export function createEnteredWebAppEntry(
  activeWorkspaceId: string
): WebAppEntryAllowed {
  return {
    kind: 'canEnterWebApp',
    activeWorkspaceId,
    capabilities: evaluateWebAppEntryCapabilities({
      hasSession: true,
      emailVerified: true,
      activeWorkspaceId,
      accessibleWorkspaceCount: 1,
    }),
  };
}

export function getWebAppEntryRedirectTarget(
  entry: WebAppEntry,
  context: 'root'
): RootWebAppEntryRedirectTarget;
export function getWebAppEntryRedirectTarget(
  entry: WebAppEntry,
  context: 'guest'
): GuestWebAppEntryRedirectTarget;
export function getWebAppEntryRedirectTarget(
  entry: WebAppEntry,
  context: WebAppEntryRedirectContext
): GuestWebAppEntryRedirectTarget {
  switch (entry.kind) {
    case 'redirect':
      if (context === 'guest' && entry.to === '/signin') {
        return null;
      }
      return entry.to;
    case 'blocked':
    case 'mustResolveWorkspace':
    case 'canEnterWebApp':
      return '/ws';
  }
}
