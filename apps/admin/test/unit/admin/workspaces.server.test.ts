import {
  deleteEntitlementOverrides,
  upsertEntitlementOverrides,
} from '@/admin/workspaces.server';

const { dbDeleteMock, dbInsertMock, dbQueryMock } = vi.hoisted(() => ({
  dbDeleteMock: vi.fn(),
  dbInsertMock: vi.fn(),
  dbQueryMock: {
    workspaceEntitlementOverrides: { findFirst: vi.fn() },
    organization: { findFirst: vi.fn() },
  },
}));

// Mock modules that import server-only dependencies.
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn(),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    and: vi.fn(),
    count: vi.fn(() => 'count_expr'),
    eq: vi.fn(),
    ilike: vi.fn(),
    or: vi.fn(),
    sql: vi.fn(),
  };
});
vi.mock('@workspace/auth/plans', () => ({
  resolveWorkspacePlanId: vi.fn(() => 'free'),
}));
vi.mock('@/init', () => ({
  auth: { api: {} },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      offset: vi.fn(() => Promise.resolve([])),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
        groupBy: vi.fn(() => ({
          as: vi.fn(),
        })),
        as: vi.fn(),
      })),
    })),
    insert: dbInsertMock,
    delete: dbDeleteMock,
    query: dbQueryMock,
  },
}));
vi.mock('@workspace/db-schema', () => ({
  organization: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    createdAt: 'createdAt',
    logo: 'logo',
  },
  member: {
    id: 'id',
    organizationId: 'organizationId',
    userId: 'userId',
    role: 'role',
  },
  subscription: {
    id: 'id',
    plan: 'plan',
    referenceId: 'referenceId',
    status: 'status',
    stripeSubscriptionId: 'stripeSubscriptionId',
    periodStart: 'periodStart',
    periodEnd: 'periodEnd',
    cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  },
  user: {
    id: 'id',
    name: 'name',
    email: 'email',
  },
  workspaceEntitlementOverrides: {
    id: 'id',
    workspaceId: 'workspaceId',
    limits: 'limits',
    features: 'features',
    quotas: 'quotas',
    notes: 'notes',
  },
}));

describe('upsertEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls db.insert with correct values and onConflictDoUpdate', async () => {
    const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
    const valuesMock = vi.fn().mockReturnValue({
      onConflictDoUpdate: onConflictDoUpdateMock,
    });
    dbInsertMock.mockReturnValue({ values: valuesMock });

    await upsertEntitlementOverrides({
      workspaceId: 'ws-1',
      limits: { members: 50 },
      features: { sso: true },
      quotas: { storageGb: 100 },
      notes: 'Test override',
    });

    expect(dbInsertMock).toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        limits: { members: 50 },
        features: { sso: true },
        quotas: { storageGb: 100 },
        notes: 'Test override',
      })
    );
    expect(onConflictDoUpdateMock).toHaveBeenCalled();
  });
});

describe('deleteEntitlementOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls db.delete with correct where clause', async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    dbDeleteMock.mockReturnValue({ where: whereMock });

    await deleteEntitlementOverrides('ws-1');

    expect(dbDeleteMock).toHaveBeenCalled();
    expect(whereMock).toHaveBeenCalled();
  });
});
