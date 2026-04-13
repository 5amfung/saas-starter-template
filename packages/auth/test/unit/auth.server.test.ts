import type { AuthConfig } from '../../src/auth.server';
import { OPERATIONS } from '../../../logging/src/operations';

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
  startSpanMock,
  loggerInfoMock,
  loggerErrorMock,
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
  const startSpanFn = vi.fn(
    async (_options, callback: () => Promise<unknown>) => callback()
  );
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
    startSpanMock: startSpanFn,
    loggerInfoMock: vi.fn(),
    loggerErrorMock: vi.fn(),
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

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    eq: vi.fn((a, b) => ({ _eq: [a, b] })),
  });
});

vi.mock('@workspace/db-schema', async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    subscription: { status: 'status', referenceId: 'referenceId' },
    user: { id: 'user_id' },
    workspaceEntitlementOverrides: {
      workspaceId: 'workspaceId',
      limits: 'limits',
      features: 'features',
      quotas: 'quotas',
    },
  });
});

vi.mock('@workspace/logging/server', async (importActual) => {
  const actual =
    await importActual<typeof import('@workspace/logging/server')>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
    workflowLogger: {
      info: loggerInfoMock,
      error: loggerErrorMock,
    },
  };
});

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
    ...overrides,
  };
}

interface BetterAuthConfig {
  advanced?: {
    cookiePrefix?: string;
  };
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
      expect(startSpanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          op: OPERATIONS.WORKSPACE_CREATE,
          name: 'Create default workspace',
          attributes: expect.objectContaining({
            operation: OPERATIONS.WORKSPACE_CREATE,
            userId: 'user_new',
            result: 'attempt',
          }),
        }),
        expect.any(Function)
      );
      expect(loggerInfoMock).toHaveBeenCalledWith(
        'Created default workspace',
        expect.objectContaining({
          operation: OPERATIONS.WORKSPACE_CREATE,
          userId: 'user_new',
          result: 'success',
        })
      );
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
      expect(loggerErrorMock).toHaveBeenCalledWith(
        'Failed to create default workspace',
        expect.objectContaining({
          operation: OPERATIONS.WORKSPACE_CREATE,
          userId: 'user_err',
          result: 'failure',
          failureCategory: 'auto_create_failed',
        })
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

      // 1) Current workspace members.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ count: 10 }]),
        }),
      });
      // 2) Active enterprise subscription.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValueOnce([{ plan: 'enterprise', status: 'active' }]),
        }),
      });
      // 3) Enterprise override lookup returns no override.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

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

      // 1) Current workspace members (starter limit is 5).
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ count: 3 }]),
        }),
      });
      // 2) Active starter subscription.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValueOnce([{ plan: 'starter', status: 'active' }]),
        }),
      });

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_starter' },
        })
      ).resolves.toBeUndefined();
      expect(loggerInfoMock).toHaveBeenCalledWith(
        'Workspace invitation allowed',
        expect.objectContaining({
          operation: OPERATIONS.WORKSPACE_MEMBER_INVITE,
          workspaceId: 'org_starter',
          result: 'success',
        })
      );
    });

    it('throws FORBIDDEN when at the member limit', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      // 1) Current workspace members (free limit is 1).
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
        }),
      });
      // 2) No active subscriptions -> free plan.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([]),
        }),
      });

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_free' },
        })
      ).rejects.toThrow('reached its member limit');
      expect(loggerErrorMock).toHaveBeenCalledWith(
        'Workspace invitation blocked by member limit',
        expect.objectContaining({
          operation: OPERATIONS.WORKSPACE_MEMBER_INVITE,
          workspaceId: 'org_free',
          result: 'failure',
          failureCategory: 'member_limit_exceeded',
        })
      );
    });

    it('throws FORBIDDEN when over the member limit', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      // 1) Current workspace members (starter limit is 5).
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ count: 5 }]),
        }),
      });
      // 2) Active starter subscription.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValueOnce([{ plan: 'starter', status: 'active' }]),
        }),
      });

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_full' },
        })
      ).rejects.toThrow('reached its member limit');
    });

    it('uses enterprise entitlement overrides when enforcing member limits', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getOrganizationPluginOpts();

      // 1) Current workspace members.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([{ count: 3 }]),
        }),
      });
      // 2) Active enterprise subscription.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValueOnce([
            {
              plan: 'enterprise',
              status: 'active',
            },
          ]),
        }),
      });
      // 3) Enterprise override with members cap = 3.
      dbSelectMock.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValueOnce([
              {
                limits: { members: 3 },
                features: null,
                quotas: null,
              },
            ]),
          }),
        }),
      });

      await expect(
        opts.organizationHooks.beforeCreateInvitation({
          organization: { id: 'org_enterprise' },
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
      expect(startSpanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          op: OPERATIONS.AUTH_SIGN_IN,
          name: 'Record last sign-in time',
          attributes: expect.objectContaining({
            operation: OPERATIONS.AUTH_SIGN_IN,
            route: '/sign-in/email',
            userId: 'user_signin',
            result: 'attempt',
          }),
        }),
        expect.any(Function)
      );
      expect(loggerInfoMock).toHaveBeenCalledWith(
        'Recorded user sign-in',
        expect.objectContaining({
          operation: OPERATIONS.AUTH_SIGN_IN,
          route: '/sign-in/email',
          userId: 'user_signin',
          result: 'success',
        })
      );
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
    it('passes advanced.cookiePrefix when provided', async () => {
      const createAuth = await importCreateAuth();

      createAuth(buildTestConfig({ cookiePrefix: 'admin' }));
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;

      expect(config.advanced?.cookiePrefix).toBe('admin');
    });

    it('omits advanced.cookiePrefix when no override is provided', async () => {
      const createAuth = await importCreateAuth();

      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;

      expect(config.advanced?.cookiePrefix).toBeUndefined();
      expect(config.advanced).toBeUndefined();
    });

    it('omits advanced.cookiePrefix when override is an empty string', async () => {
      const createAuth = await importCreateAuth();

      createAuth(buildTestConfig({ cookiePrefix: '' }));
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;

      expect(config.advanced?.cookiePrefix).toBeUndefined();
      expect(config.advanced).toBeUndefined();
    });

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
