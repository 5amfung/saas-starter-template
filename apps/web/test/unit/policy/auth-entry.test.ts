import { describe, expect, it } from 'vitest';
import type {
  AdminAppEntryFacts,
  WebAppEntryFacts,
} from '@/policy/core/auth-entry';
import {
  evaluateAdminAppEntryCapabilities,
  evaluateWebAppEntryCapabilities,
} from '@/policy/core/auth-entry';

describe('evaluateWebAppEntryCapabilities', () => {
  it('denies guests and requires sign-in', () => {
    const capabilities = evaluateWebAppEntryCapabilities({
      hasSession: false,
      emailVerified: false,
      activeWorkspaceId: null,
      accessibleWorkspaceCount: 0,
    } satisfies WebAppEntryFacts);

    expect(capabilities.canEnterWebApp).toBe(false);
    expect(capabilities.mustSignIn).toBe(true);
    expect(capabilities.mustVerifyEmail).toBe(false);
    expect(capabilities.mustResolveWorkspace).toBe(false);
  });

  it('requires email verification for signed-in unverified users', () => {
    const capabilities = evaluateWebAppEntryCapabilities({
      hasSession: true,
      emailVerified: false,
      activeWorkspaceId: null,
      accessibleWorkspaceCount: 1,
    } satisfies WebAppEntryFacts);

    expect(capabilities.canEnterWebApp).toBe(false);
    expect(capabilities.mustSignIn).toBe(false);
    expect(capabilities.mustVerifyEmail).toBe(true);
    expect(capabilities.mustResolveWorkspace).toBe(false);
  });

  it('requires workspace resolution for verified users without an active workspace', () => {
    const capabilities = evaluateWebAppEntryCapabilities({
      hasSession: true,
      emailVerified: true,
      activeWorkspaceId: null,
      accessibleWorkspaceCount: 2,
    } satisfies WebAppEntryFacts);

    expect(capabilities.canEnterWebApp).toBe(false);
    expect(capabilities.mustSignIn).toBe(false);
    expect(capabilities.mustVerifyEmail).toBe(false);
    expect(capabilities.mustResolveWorkspace).toBe(true);
  });

  it('requires workspace resolution for verified users with no accessible workspaces', () => {
    const capabilities = evaluateWebAppEntryCapabilities({
      hasSession: true,
      emailVerified: true,
      activeWorkspaceId: null,
      accessibleWorkspaceCount: 0,
    } satisfies WebAppEntryFacts);

    expect(capabilities.canEnterWebApp).toBe(false);
    expect(capabilities.mustSignIn).toBe(false);
    expect(capabilities.mustVerifyEmail).toBe(false);
    expect(capabilities.mustResolveWorkspace).toBe(true);
  });

  it('allows verified users with an active workspace to enter', () => {
    const capabilities = evaluateWebAppEntryCapabilities({
      hasSession: true,
      emailVerified: true,
      activeWorkspaceId: 'workspace_123',
      accessibleWorkspaceCount: 2,
    } satisfies WebAppEntryFacts);

    expect(capabilities.canEnterWebApp).toBe(true);
    expect(capabilities.mustSignIn).toBe(false);
    expect(capabilities.mustVerifyEmail).toBe(false);
    expect(capabilities.mustResolveWorkspace).toBe(false);
  });
});

describe('evaluateAdminAppEntryCapabilities', () => {
  it('denies guests and requires sign-in', () => {
    const capabilities = evaluateAdminAppEntryCapabilities({
      hasSession: false,
      emailVerified: false,
      platformRole: null,
    } satisfies AdminAppEntryFacts);

    expect(capabilities.canEnterAdminApp).toBe(false);
    expect(capabilities.mustSignIn).toBe(true);
    expect(capabilities.mustVerifyEmail).toBe(false);
    expect(capabilities.isAdminOnlyDenied).toBe(false);
  });

  it('denies verified non-admin users with an admin-only outcome', () => {
    const capabilities = evaluateAdminAppEntryCapabilities({
      hasSession: true,
      emailVerified: true,
      platformRole: 'user',
    } satisfies AdminAppEntryFacts);

    expect(capabilities.canEnterAdminApp).toBe(false);
    expect(capabilities.mustSignIn).toBe(false);
    expect(capabilities.mustVerifyEmail).toBe(false);
    expect(capabilities.isAdminOnlyDenied).toBe(true);
  });

  it('requires email verification for signed-in unverified admin-app users', () => {
    const capabilities = evaluateAdminAppEntryCapabilities({
      hasSession: true,
      emailVerified: false,
      platformRole: 'admin',
    } satisfies AdminAppEntryFacts);

    expect(capabilities.canEnterAdminApp).toBe(false);
    expect(capabilities.mustSignIn).toBe(false);
    expect(capabilities.mustVerifyEmail).toBe(true);
    expect(capabilities.isAdminOnlyDenied).toBe(false);
  });

  it('allows verified admins to enter', () => {
    const capabilities = evaluateAdminAppEntryCapabilities({
      hasSession: true,
      emailVerified: true,
      platformRole: 'admin',
    } satisfies AdminAppEntryFacts);

    expect(capabilities.canEnterAdminApp).toBe(true);
    expect(capabilities.mustSignIn).toBe(false);
    expect(capabilities.mustVerifyEmail).toBe(false);
    expect(capabilities.isAdminOnlyDenied).toBe(false);
  });
});
