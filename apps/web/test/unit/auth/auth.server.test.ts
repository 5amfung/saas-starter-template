import type * as LoggingServer from '@/observability/server';
import type { AuthConfig } from '@/auth/server/auth.server';
import { METRICS, OPERATIONS } from '@/observability/server';

// ---------------------------------------------------------------------------
// Hoisted mocks — references used inside vi.mock() definitions.
// ---------------------------------------------------------------------------

const {
  createOrganizationMock,
  apiKeyPluginSpy,
  betterAuthSpy,
  createBillingHelpersMock,
  billingMock,
  createAuthEmailsMock,
  dbSelectMock,
  dbUpdateMock,
  stripeMock,
  organizationPluginSpy,
  generateSlugMock,
  startSpanMock,
  loggerInfoMock,
  loggerErrorMock,
  emitCountMetricMock,
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
    apiKeyPluginSpy: vi.fn(),
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
    generateSlugMock: vi.fn(),
    startSpanMock: startSpanFn,
    loggerInfoMock: vi.fn(),
    loggerErrorMock: vi.fn(),
    emitCountMetricMock: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks.
// ---------------------------------------------------------------------------

vi.mock('@better-auth/api-key', () => ({
  apiKey: apiKeyPluginSpy.mockImplementation((configs) => ({
    _type: 'api-key-plugin',
    _configs: configs,
  })),
}));

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

vi.mock('@/db/schema', async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    subscription: { status: 'status', referenceId: 'referenceId' },
    user: { id: 'user_id' },
    entitlementOverrides: {
      workspaceId: 'workspaceId',
      limits: 'limits',
      features: 'features',
      quotas: 'quotas',
    },
  });
});

vi.mock('@/observability/server', async (importActual) => {
  const actual = await importActual<typeof LoggingServer>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
    workflowLogger: {
      info: loggerInfoMock,
      error: loggerErrorMock,
    },
    emitCountMetric: emitCountMetricMock,
  };
});

vi.mock('@/auth/server/billing.server', () => ({
  createBillingHelpers: createBillingHelpersMock,
}));

vi.mock('@/auth/server/auth-emails.server', () => ({
  createAuthEmails: createAuthEmailsMock,
}));

vi.mock('@/auth/core/slug', () => ({
  generateSlug: generateSlugMock,
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
  emailAndPassword?: {
    onPasswordReset?: (data: { user: { id: string } }) => Promise<void>;
  };
  emailVerification?: {
    afterEmailVerification?: (user: { id: string }) => Promise<void>;
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

function getStripeSubscriptionOpts() {
  const call = stripeMock.mock.calls[0];
  return call[0] as {
    subscription: {
      onSubscriptionComplete: (data: {
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
        plan: { name: string };
      }) => Promise<void>;
      onSubscriptionCreated: (data: {
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
        plan: { name: string };
      }) => Promise<void>;
      onSubscriptionUpdate: (data: {
        event: unknown;
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
      }) => Promise<void>;
      onSubscriptionDeleted: (data: {
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
      }) => Promise<void>;
    };
  };
}

function getOrganizationPluginOpts() {
  const call = organizationPluginSpy.mock.calls[0];
  return call[0] as {
    ac: { statements: { apiKey: Array<string> } };
    roles: {
      owner: { statements: { apiKey: Array<string> } };
      admin: { statements: { apiKey: Array<string> } };
      member: { statements: { apiKey: Array<string> } };
    };
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
    const mod = await import('@/auth/server/auth.server');
    return mod.createAuth;
  }

  // ─── databaseHooks.user.create.after ────────────────────────────────

  describe('user create hook — auto-create personal workspace', () => {
    it('passes the generated slug through to organization creation', async () => {
      const createAuth = await importCreateAuth();
      createOrganizationMock.mockResolvedValueOnce({});
      generateSlugMock.mockReturnValueOnce('alpha-bravo-charlie-d1e2');

      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const hook = config.databaseHooks!.user!.create!.after!;

      await hook({ id: 'user_new' });

      expect(createOrganizationMock).toHaveBeenCalledWith({
        body: expect.objectContaining({
          name: 'My Workspace',
          userId: 'user_new',
          slug: 'alpha-bravo-charlie-d1e2',
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
      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.AUTH_SIGNUP_CREATED,
        { route: '/api/auth/$', result: 'success' }
      );
    });

    it('retries duplicate slug collisions and eventually succeeds', async () => {
      const createAuth = await importCreateAuth();
      generateSlugMock
        .mockReturnValueOnce('alpha-bravo-charlie-d1e2')
        .mockReturnValueOnce('delta-echo-foxtrot-a1b2');
      createOrganizationMock
        .mockRejectedValueOnce(new Error('Organization slug already exists'))
        .mockResolvedValueOnce({});

      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const hook = config.databaseHooks!.user!.create!.after!;

      await expect(hook({ id: 'user_dup' })).resolves.toBeUndefined();

      expect(generateSlugMock).toHaveBeenCalledTimes(2);
      expect(createOrganizationMock).toHaveBeenNthCalledWith(1, {
        body: expect.objectContaining({
          name: 'My Workspace',
          userId: 'user_dup',
          slug: 'alpha-bravo-charlie-d1e2',
        }),
      });
      expect(createOrganizationMock).toHaveBeenNthCalledWith(2, {
        body: expect.objectContaining({
          name: 'My Workspace',
          userId: 'user_dup',
          slug: 'delta-echo-foxtrot-a1b2',
        }),
      });
      expect(loggerInfoMock).toHaveBeenCalledWith(
        'Created default workspace',
        expect.objectContaining({
          operation: OPERATIONS.WORKSPACE_CREATE,
          userId: 'user_dup',
          result: 'success',
        })
      );
    });

    it('logs duplicate exhaustion and still resolves after exhausting retries', async () => {
      const createAuth = await importCreateAuth();
      generateSlugMock
        .mockReturnValueOnce('alpha-bravo-charlie-d1e2')
        .mockReturnValueOnce('delta-echo-foxtrot-a1b2')
        .mockReturnValueOnce('golf-hotel-india-c3d4');
      createOrganizationMock
        .mockRejectedValueOnce(new Error('Organization slug already exists'))
        .mockRejectedValueOnce(new Error('Organization slug already exists'))
        .mockRejectedValueOnce(new Error('Organization slug already exists'));

      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const hook = config.databaseHooks!.user!.create!.after!;

      await expect(hook({ id: 'user_dup_all' })).resolves.toBeUndefined();

      expect(generateSlugMock).toHaveBeenCalledTimes(3);
      expect(createOrganizationMock).toHaveBeenCalledTimes(3);
      expect(loggerInfoMock).not.toHaveBeenCalled();
      expect(loggerErrorMock).toHaveBeenCalledWith(
        'Failed to create default workspace after exhausting duplicate slug retries',
        expect.objectContaining({
          operation: OPERATIONS.WORKSPACE_CREATE,
          userId: 'user_dup_all',
          result: 'failure',
          failureCategory: 'duplicate_slug_collision_exhausted',
        })
      );
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

      await expect(hook({ id: 'user_err' })).rejects.toMatchObject({
        message: expect.stringContaining('Connection refused'),
      });
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
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Cannot delete a workspace with an active subscription'
        ),
      });
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
      ).rejects.toMatchObject({
        message: expect.stringContaining(
          'Cannot delete a workspace with an active subscription'
        ),
      });
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
      ).rejects.toMatchObject({
        message: expect.stringContaining('Cannot delete your last workspace'),
      });
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
      ).rejects.toMatchObject({
        message: expect.stringContaining('reached its member limit'),
      });
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
      ).rejects.toMatchObject({
        message: expect.stringContaining('reached its member limit'),
      });
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
      ).rejects.toMatchObject({
        message: expect.stringContaining('reached its member limit'),
      });
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

    it('records a Google sign-in metric only for successful Google callbacks', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const afterHook = config.hooks!.after!;

      await afterHook({
        path: '/callback/google',
        context: { newSession: { user: { id: 'user_google' } } },
      });

      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.AUTH_SIGNIN_GOOGLE_COMPLETED,
        { provider: 'google', route: '/api/auth/$', result: 'success' }
      );
    });

    it('does not record a Google sign-in metric for email sign-in', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
      const afterHook = config.hooks!.after!;

      await afterHook({
        path: '/sign-in/email',
        context: { newSession: { user: { id: 'user_email' } } },
      });

      expect(emitCountMetricMock).not.toHaveBeenCalledWith(
        METRICS.AUTH_SIGNIN_GOOGLE_COMPLETED,
        expect.anything()
      );
    });
  });

  describe('auth confirmation callbacks', () => {
    it('records verified signup after Better Auth verifies email', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;

      await config.emailVerification!.afterEmailVerification!({ id: 'user_1' });

      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.AUTH_SIGNUP_VERIFIED,
        { route: '/api/auth/$', result: 'success' }
      );
    });

    it('records completed password reset from Better Auth onPasswordReset', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;

      await config.emailAndPassword!.onPasswordReset!({
        user: { id: 'user_1' },
      });

      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.AUTH_PASSWORD_RESET_COMPLETED,
        { route: '/api/auth/$', result: 'success' }
      );
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

    it('records confirmed Starter and Pro subscription creation from Stripe callbacks', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getStripeSubscriptionOpts();

      await opts.subscription.onSubscriptionComplete({
        subscription: {
          id: 'sub_1',
          plan: 'starter',
          referenceId: 'org_1',
          status: 'active',
        },
        plan: { name: 'starter' },
      });
      await opts.subscription.onSubscriptionCreated({
        subscription: {
          id: 'sub_2',
          plan: 'pro',
          referenceId: 'org_1',
          status: 'active',
        },
        plan: { name: 'pro' },
      });

      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.BILLING_SUBSCRIPTION_STARTER_CREATED,
        { plan: 'starter', result: 'success' }
      );
      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.BILLING_SUBSCRIPTION_PRO_CREATED,
        { plan: 'pro', result: 'success' }
      );
    });

    it('records confirmed downgrade to Free from subscription deletion', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getStripeSubscriptionOpts();

      await opts.subscription.onSubscriptionDeleted({
        subscription: {
          id: 'sub_1',
          plan: 'pro',
          referenceId: 'org_1',
          status: 'active',
        },
      });

      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.BILLING_SUBSCRIPTION_FREE_DOWNGRADED,
        { fromPlan: 'pro', toPlan: 'free', result: 'success' }
      );
    });

    it('records confirmed downgrade to Starter when previous Stripe price resolves to a higher plan', async () => {
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_pro_monthly';
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getStripeSubscriptionOpts();

      await opts.subscription.onSubscriptionUpdate({
        event: {
          data: {
            previous_attributes: {
              items: {
                data: [
                  {
                    price: { id: 'price_pro_monthly' },
                  },
                ],
              },
            },
          },
        },
        subscription: {
          id: 'sub_1',
          plan: 'starter',
          referenceId: 'org_1',
          status: 'active',
        },
      });

      expect(emitCountMetricMock).toHaveBeenCalledWith(
        METRICS.BILLING_SUBSCRIPTION_STARTER_DOWNGRADED,
        { fromPlan: 'pro', toPlan: 'starter', result: 'success' }
      );
    });

    it('does not record downgrade to Starter when previous plan cannot be resolved', async () => {
      const createAuth = await importCreateAuth();
      createAuth(buildTestConfig());
      const opts = getStripeSubscriptionOpts();

      await opts.subscription.onSubscriptionUpdate({
        event: {
          data: {
            previous_attributes: {},
          },
        },
        subscription: {
          id: 'sub_1',
          plan: 'starter',
          referenceId: 'org_1',
          status: 'active',
        },
      });

      expect(emitCountMetricMock).not.toHaveBeenCalledWith(
        METRICS.BILLING_SUBSCRIPTION_STARTER_DOWNGRADED,
        expect.anything()
      );
    });
  });

  describe('plugin wiring', () => {
    it('registers the system-managed organization api key config', async () => {
      const createAuth = await importCreateAuth();

      createAuth(buildTestConfig());

      expect(apiKeyPluginSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          configId: 'system-managed',
          references: 'organization',
          rateLimit: {
            enabled: true,
            maxRequests: 5000,
            timeWindow: 1000 * 60 * 5,
          },
        }),
      ]);
    });

    it('passes organization api key access control into the organization plugin', async () => {
      const createAuth = await importCreateAuth();

      createAuth(buildTestConfig());

      const opts = getOrganizationPluginOpts();

      expect(opts.ac.statements.apiKey).toEqual([
        'create',
        'read',
        'update',
        'delete',
      ]);
      expect(opts.roles.owner.statements.apiKey).toEqual([
        'create',
        'read',
        'update',
        'delete',
      ]);
      expect(opts.roles.admin.statements.apiKey).toEqual([
        'create',
        'read',
        'update',
        'delete',
      ]);
      expect(opts.roles.member.statements.apiKey).toEqual(['read']);
    });
  });
});
