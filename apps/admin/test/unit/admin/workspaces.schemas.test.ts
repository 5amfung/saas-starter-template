import {
  entitlementOverrideSchema,
  workspaceApiKeyAccessModeSchema,
  workspaceApiKeyCreateSchema,
  workspaceApiKeyDeleteSchema,
} from '@/admin/workspaces.schemas';

describe('entitlementOverrideSchema', () => {
  const validData = {
    workspaceId: 'ws-123',
    limits: { members: 10, projects: 5 },
    features: { sso: true, auditLogs: false },
    quotas: { storageGb: 100 },
    notes: 'Custom enterprise deal',
  };

  it('accepts valid override data', () => {
    expect(entitlementOverrideSchema.safeParse(validData).success).toBe(true);
  });

  it('accepts minimal data with only workspaceId', () => {
    expect(
      entitlementOverrideSchema.safeParse({ workspaceId: 'ws-1' }).success
    ).toBe(true);
  });

  it('accepts -1 (unlimited) for numeric fields', () => {
    const result = entitlementOverrideSchema.safeParse({
      workspaceId: 'ws-1',
      limits: { members: -1 },
      quotas: { storageGb: -1 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects values below -1 for limits', () => {
    expect(
      entitlementOverrideSchema.safeParse({
        workspaceId: 'ws-1',
        limits: { members: -2 },
      }).success
    ).toBe(false);
  });

  it('rejects unknown limit keys', () => {
    expect(
      entitlementOverrideSchema.safeParse({
        workspaceId: 'ws-1',
        limits: { members: 10, workspaces: 3 },
      }).success
    ).toBe(false);
  });

  it('rejects values below -1 for quotas', () => {
    expect(
      entitlementOverrideSchema.safeParse({
        workspaceId: 'ws-1',
        quotas: { storageGb: -5 },
      }).success
    ).toBe(false);
  });

  it('rejects non-integer limit values', () => {
    expect(
      entitlementOverrideSchema.safeParse({
        workspaceId: 'ws-1',
        limits: { members: 1.5 },
      }).success
    ).toBe(false);
  });

  it('rejects missing workspaceId', () => {
    expect(
      entitlementOverrideSchema.safeParse({ limits: { members: 10 } }).success
    ).toBe(false);
  });

  it('accepts all optional fields as undefined', () => {
    const result = entitlementOverrideSchema.safeParse({
      workspaceId: 'ws-1',
      limits: undefined,
      features: undefined,
      quotas: undefined,
      notes: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('preserves parsed values', () => {
    const result = entitlementOverrideSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workspaceId).toBe('ws-123');
      expect(result.data.limits?.members).toBe(10);
      expect(result.data.features?.sso).toBe(true);
      expect(result.data.quotas?.storageGb).toBe(100);
      expect(result.data.notes).toBe('Custom enterprise deal');
    }
  });
});

describe('workspaceApiKeyAccessModeSchema', () => {
  it('accepts read-only and read-write modes', () => {
    expect(workspaceApiKeyAccessModeSchema.parse('read_only')).toBe(
      'read_only'
    );
    expect(workspaceApiKeyAccessModeSchema.parse('read_write')).toBe(
      'read_write'
    );
  });

  it('rejects unknown access modes', () => {
    expect(() => workspaceApiKeyAccessModeSchema.parse('admin')).toThrow();
  });
});

describe('workspaceApiKeyCreateSchema', () => {
  it('accepts a workspace id with a valid access mode', () => {
    expect(
      workspaceApiKeyCreateSchema.parse({
        workspaceId: 'ws-1',
        accessMode: 'read_only',
      })
    ).toEqual({
      workspaceId: 'ws-1',
      accessMode: 'read_only',
    });
  });

  it('rejects missing workspace ids', () => {
    expect(() =>
      workspaceApiKeyCreateSchema.parse({
        accessMode: 'read_write',
      })
    ).toThrow();
  });
});

describe('workspaceApiKeyDeleteSchema', () => {
  it('accepts a workspace id and api key id', () => {
    expect(
      workspaceApiKeyDeleteSchema.parse({
        workspaceId: 'ws-1',
        apiKeyId: 'key-1',
      })
    ).toEqual({
      workspaceId: 'ws-1',
      apiKeyId: 'key-1',
    });
  });

  it('rejects missing api key ids', () => {
    expect(() =>
      workspaceApiKeyDeleteSchema.parse({
        workspaceId: 'ws-1',
      })
    ).toThrow();
  });
});
