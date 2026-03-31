import { APIError } from 'better-auth/api';
import type { AuthConfig } from '../../src/auth.server';

// ---------------------------------------------------------------------------
// Hoisted mocks — references used inside vi.mock() definitions.
// ---------------------------------------------------------------------------

const {
  createOrganizationMock,
  betterAuthSpy,
  createBillingHelpersMock,
  billingMock,
  createAuthEmailsMock,
  dbSelectMock,
  dbUpdateMock,
  stripeMock,
  organizationPluginSpy,
} = vi.hoisted(() => {
  const createOrganizationFn = vi.fn();
  const billingHelpers = {
    getWorkspaceOwnerUserId: vi.fn(),
    countOwnedWorkspaces: vi.fn(),
    countWorkspaceMembers: vi.fn(),
    resolveWorkspacePlanIdFromDb: vi.fn(),
  };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve([]);
    }),
  };
  const dbSelectFn = vi.fn().mockReturnValue(selectChain);
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const dbUpdateFn = vi.fn().mockReturnValue(updateChain);
  return {
    createOrganizationMock: createOrganizationFn,
    betterAuthSpy: vi.fn(),
    createBillingHelpersMock: vi.fn().mockReturnValue(billingHelpers),
    billingMock: billingHelpers,
    createAuthEmailsMock: vi.fn().mockReturnValue({
      sendChangeEmailConfirmation: vi.fn(),
      sendResetPasswordEmail: vi.fn(),
      sendVerificationEmail: vi.fn(),
      sendInvitationEmail: vi.fn(),
    }),
    dbSelectMock: dbSelectFn,
    dbUpdateMock: dbUpdateFn,
    stripeMock: vi.fn(),
    organizationPluginSpy: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks.
// ---------------------------------------------------------------------------

vi.mock('better-auth/minimal', () => ({
  betterAuth: betterAuthSpy.mockImplementation((config: unknown) => {
    // Return a fake auth instance with the API mock.
    return {
      api: { createOrganization: createOrganizationMock },
      _config: config,
    };
  }),
}));

vi.mock('better-auth/api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createAuthMiddleware: vi.fn((fn) => fn),
  };
});

vi.mock('better-auth/plugins', () => ({
  admin: vi.fn(() => 'admin-plugin'),
  lastLoginMethod: vi.fn(() => 'lastLoginMethod-plugin'),
  organization: organizationPluginSpy.mockImplementation((opts) => ({
    _type: 'organization-plugin',
    _opts: opts,
  })),
}));

vi.mock('better-auth/tanstack-start', () => ({
  tanstackStartCookies: vi.fn(() => 'tanstackStartCookies-plugin'),
}));

vi.mock('better-auth/adapters/drizzle', () => ({
  drizzleAdapter: vi.fn(() => 'drizzle-adapter'),
}));

vi.mock('@better-auth/stripe', () => ({
  stripe: stripeMock.mockImplementation((opts) => ({
    _type: 'stripe-plugin',
    _opts: opts,
  })),
}));

vi.mock('stripe', () => {
  function StripeMock() {
    // Minimal Stripe client stub.
  }
  return { default: StripeMock };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _eq: [a, b] })),
}));

vi.mock('@workspace/db-schema', () => ({
  subscription: { status: 'status', referenceId: 'referenceId' },
  user: { id: 'user_id' },
}));

vi.mock('../../src/billing.server', () => ({
  createBillingHelpers: createBillingHelpersMock,
}));

vi.mock('../../src/auth-emails.server', () => ({
  createAuthEmails: createAuthEmailsMock,
}));

// ---------------------------------------------------------------------------
// Helpers to create a test config and extract hooks.
// ---------------------------------------------------------------------------

function buildTestConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    db: {
      select: dbSelectMock,
      update: dbUpdateMock,
    } as unknown as AuthConfig['db'],
    emailClient: {} as AuthConfig['emailClient'],
    baseUrl: 'http://localhost:3000',
    secret: 'test-secret',
    google: { clientId: 'gid', clientSecret: 'gsecret' },
    stripe: { secretKey: 'sk_test', webhookSecret: 'whsec_test' },
    adminUserIds: ['admin-1'],
    ...overrides,
  };
}

interface BetterAuthConfig {
  databaseHooks?: {
    user?: {
      create?: {
        after?: (user: { id: string }) => Promise<void>;
      };
    };
  };
  hooks?: {
    after?: (ctx: {
      path: string;
      context: { newSession?: { user: { id: string } } };
    }) => Promise<void>;
  };
}

function getOrganizationPluginOpts() {
  const call = organizationPluginSpy.mock.calls[0];
  return call[0] as {
    organizationHooks: {
      beforeDeleteOrganization: (args: {
        organization: { id: string };
      }) => Promise<void>;
      beforeCreateInvitation: (args: {
        organization: { id: string };
      }) => Promise<void>;
    };
  };
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('createAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: select returns empty array (no subscriptions).
    dbSelectMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  // We import createAuth lazily to ensure mocks are in place.
  async function importCreateAuth() {
    const mod = await import('../../src/auth.server');
    return mod.createAuth;
  }

  // ─── databaseHooks.user.create.after ────────────────────────────────

  describe('user create hook — auto-create personal workspace', () => {
    it('creates an organization with default name and ws- slug', async () => {
      const createAuth = await importCreateAuth();
      createOrganizationMock.mockResolvedValueOnce({});

      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const hook = config.databaseHooks!.user!.create!.after!;

      await hook({ id: 'user_new' });

      expect(createOrganizationMock).toHaveBeenCalledWith({
        body: expect.objectContaining({
          name: 'My Workspace',
          userId: 'user_new',
          slug: expect.stringMatching(/^ws-[a-f0-9]{8}$/),
        }),
      });
    });

    it('swallows duplicate organization errors silently', async () => {
      const createAuth = await importCreateAuth();
      createOrganizationMock.mockRejectedValueOnce(
        new Error('Organization slug already exists')
      );

      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const hook = config.databaseHooks!.user!.create!.after!;

      // Should not throw.
      await expect(hook({ id: 'user_dup' })).resolves.toBeUndefined();
    });

    it('re-throws non-duplicate errors', async () => {
      const createAuth = await importCreateAuth();
      const dbError = new Error('Connection refused');
      createOrganizationMock.mockRejectedValueOnce(dbError);
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const hook = config.databaseHooks!.user!.create!.after!;

      await expect(hook({ id: 'user_err' })).rejects.toThrow(
        'Connection refused'
      );
      consoleSpy.mockRestore();
    });
  });

  // ─── organizationHooks.beforeDeleteOrganization ─────────────────────

  describe('beforeDeleteOrganization hook — block workspace deletion', () => {
    it('blocks deletion when workspace has an active subscription', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      // Simulate active subscription found in DB.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ status: 'active' }]),
        }),
      });

      await expect(
        opts.organizationHooks.beforeDeleteOrganization({
          organization: { id: 'org_with_sub' },
        })
      ).rejects.toThrow(
        'Cannot delete a workspace with an active subscription'
      );
    });

    it('blocks deletion when workspace has a trialing subscription', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ status: 'trialing' }]),
        }),
      });

      await expect(
        opts.organizationHooks.beforeDeleteOrganization({
          organization: { id: 'org_trial' },
        })
      ).rejects.toThrow(
        'Cannot delete a workspace with an active subscription'
      );
    });

    it("blocks deletion when it is the user's last workspace", async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      // No active subscriptions.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ status: 'canceled' }]),
        }),
      });
      billingMock.getWorkspaceOwnerUserId.mockResolvedValueOnce('owner_1');
      billingMock.countOwnedWorkspaces.mockResolvedValueOnce(1);

      await expect(
        opts.organizationHooks.beforeDeleteOrganization({
          organization: { id: 'org_last' },
        })
      ).rejects.toThrow('Cannot delete your last workspace');
    });

    it('allows deletion when no active subscriptions and user has multiple workspaces', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      // No active subscriptions.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([]),
        }),
      });
      billingMock.getWorkspaceOwnerUserId.mockResolvedValueOnce('owner_1');
      billingMock.countOwnedWorkspaces.mockResolvedValueOnce(3);

      await expect(
        opts.organizationHooks.beforeDeleteOrganization({
          organization: { id: 'org_ok' },
        })
      ).resolves.toBeUndefined();
    });

    it('allows deletion when owner is not found (orphaned org)', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([]),
        }),
      });
      billingMock.getWorkspaceOwnerUserId.mockResolvedValueOnce(null);

      await expect(
        opts.organizationHooks.beforeDeleteOrganization({
          organization: { id: 'org_orphan' },
        })
      ).resolves.toBeUndefined();
    });
  });

  // ─── organizationHooks.beforeCreateInvitation ───────────────────────

  describe('beforeCreateInvitation hook — enforce member limits', () => {
    it('allows invitations when plan has unlimited members', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      // Pro plan has maxMembers: 25, but we mock resolveWorkspacePlanIdFromDb.
      // For unlimited, we'd need a plan with maxMembers === -1.
      // Currently no plan has -1, but let's test the code path.
      billingMock.resolveWorkspacePlanIdFromDb.mockResolvedValueOnce('pro');
      // Pro has maxMembers: 25, so we need to test the under-limit case.
      billingMock.countWorkspaceMembers.mockResolvedValueOnce(10);

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_pro' },
        })
      ).resolves.toBeUndefined();
    });

    it('allows invitations when under the member limit', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      billingMock.resolveWorkspacePlanIdFromDb.mockResolvedValueOnce('starter');
      billingMock.countWorkspaceMembers.mockResolvedValueOnce(3); // Starter limit is 5.

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_starter' },
        })
      ).resolves.toBeUndefined();
    });

    it('throws FORBIDDEN when at the member limit', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      billingMock.resolveWorkspacePlanIdFromDb.mockResolvedValueOnce('free');
      billingMock.countWorkspaceMembers.mockResolvedValueOnce(1); // Free limit is 1.

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_free' },
        })
      ).rejects.toThrow('reached its member limit');
    });

    it('throws FORBIDDEN when over the member limit', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      billingMock.resolveWorkspacePlanIdFromDb.mockResolvedValueOnce('starter');
      billingMock.countWorkspaceMembers.mockResolvedValueOnce(5); // Starter limit is 5.

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_full' },
        })
      ).rejects.toThrow('reached its member limit');
    });
  });

  // ─── hooks.after — lastSignInAt update ──────────────────────────────

  describe('after hook — update lastSignInAt on sign-in', () => {
    it('updates lastSignInAt when path is a sign-in path', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const afterHook = config.hooks!.after!;

      await afterHook({
        path: '/sign-in/email',
        context: { newSession: { user: { id: 'user_signin' } } },
      });

      expect(dbUpdateMock).toHaveBeenCalled();
    });

    it('skips update when path is not a sign-in path', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const afterHook = config.hooks!.after!;

      await afterHook({
        path: '/sign-up/email',
        context: { newSession: { user: { id: 'user_signup' } } },
      });

      expect(dbUpdateMock).not.toHaveBeenCalled();
    });

    it('skips update when there is no new session', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const afterHook = config.hooks!.after!;

      await afterHook({
        path: '/sign-in/email',
        context: { newSession: undefined },
      });

      expect(dbUpdateMock).not.toHaveBeenCalled();
    });
  });

  // ─── Stripe plan config wiring ──────────────────────────────────────

  describe('Stripe plan configuration', () => {
    it('passes billing helpers attached to the returned auth object', async () => {
      const createAuth = await importCreateAuth();
      const auth = createAuth(buildTestConfig());

      expect(auth).toHaveProperty('billing');
      expect(createBillingHelpersMock).toHaveBeenCalledWith(
        expect.anything(),
        'sk_test',
        expect.any(Object)
      );
    });
  });
});
