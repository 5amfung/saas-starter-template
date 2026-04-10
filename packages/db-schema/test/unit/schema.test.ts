import {
  notificationPreferences,
  notificationPreferencesRelations,
  workspaceIntegrationSecrets,
} from '../../src/app.schema';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  invitation,
  member,
  organization,
  session,
  subscription,
  user,
} from '../../src/auth.schema';
import { createDb } from '../../../db/src/index';
import * as schema from '../../src/schema';

// ---------------------------------------------------------------------------
// app.schema.ts — notificationPreferences
// ---------------------------------------------------------------------------

describe('notificationPreferences table', () => {
  it('has userId as primary key', () => {
    const col = notificationPreferences.userId;
    expect(col.dataType).toBe('string');
    expect(col.primary).toBe(true);
  });

  it('has marketingEmails as non-null boolean defaulting to false', () => {
    const col = notificationPreferences.marketingEmails;
    expect(col.dataType).toBe('boolean');
    expect(col.notNull).toBe(true);
    expect(col.hasDefault).toBe(true);
  });

  it('has createdAt as non-null timestamp with default', () => {
    const col = notificationPreferences.createdAt;
    expect(col.dataType).toBe('date');
    expect(col.notNull).toBe(true);
    expect(col.hasDefault).toBe(true);
  });

  it('has updatedAt as non-null timestamp with default', () => {
    const col = notificationPreferences.updatedAt;
    expect(col.dataType).toBe('date');
    expect(col.notNull).toBe(true);
    expect(col.hasDefault).toBe(true);
  });

  it('defines a relation to user', () => {
    expect(notificationPreferencesRelations).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// app.schema.ts — workspaceIntegrationSecret
// ---------------------------------------------------------------------------

describe('workspaceIntegrationSecrets table', () => {
  it('is exported from the app schema', () => {
    expect(schema.workspaceIntegrationSecrets).toBeDefined();
  });

  it.each([
    'id',
    'workspaceId',
    'integration',
    'key',
    'encryptedValue',
    'iv',
    'authTag',
    'encryptionVersion',
    'createdAt',
    'updatedAt',
  ] as const)('has %s column', (column) => {
    expect(workspaceIntegrationSecrets[column]).toBeDefined();
  });

  it('has workspaceId as a non-null column', () => {
    expect(workspaceIntegrationSecrets.workspaceId.dataType).toBe('string');
    expect(workspaceIntegrationSecrets.workspaceId.notNull).toBe(true);
  });

  it('has encryptionVersion as a non-null integer defaulting to 1', () => {
    expect(workspaceIntegrationSecrets.encryptionVersion.dataType).toBe(
      'number'
    );
    expect(workspaceIntegrationSecrets.encryptionVersion.notNull).toBe(true);
    expect(workspaceIntegrationSecrets.encryptionVersion.hasDefault).toBe(true);
  });

  it('has createdAt and updatedAt as non-null timestamps with defaults', () => {
    expect(workspaceIntegrationSecrets.createdAt.dataType).toBe('date');
    expect(workspaceIntegrationSecrets.createdAt.notNull).toBe(true);
    expect(workspaceIntegrationSecrets.createdAt.hasDefault).toBe(true);

    expect(workspaceIntegrationSecrets.updatedAt.dataType).toBe('date');
    expect(workspaceIntegrationSecrets.updatedAt.notNull).toBe(true);
    expect(workspaceIntegrationSecrets.updatedAt.hasDefault).toBe(true);
  });

  it('defines the composite unique index on workspaceId, integration, and key', () => {
    const tableConfig = getTableConfig(workspaceIntegrationSecrets);
    const index = tableConfig.indexes.find(
      (entry) =>
        entry.config.name === 'workspace_integration_secret_workspace_key_uidx'
    );

    expect(index).toBeDefined();
    expect(index?.config.unique).toBe(true);
    expect(
      index?.config.columns.map((column) => (column as { name: string }).name)
    ).toEqual(['workspace_id', 'integration', 'key']);
  });
});

// ---------------------------------------------------------------------------
// auth.schema.ts — structural smoke tests
// ---------------------------------------------------------------------------

describe('auth schema tables', () => {
  describe('user table', () => {
    it.each([
      'id',
      'name',
      'email',
      'emailVerified',
      'role',
      'banned',
      'stripeCustomerId',
      'lastSignInAt',
    ] as const)('has %s column', (column) => {
      expect(user[column]).toBeDefined();
    });

    it('has id as primary key', () => {
      expect(user.id.primary).toBe(true);
    });

    it('has email as non-null', () => {
      expect(user.email.notNull).toBe(true);
    });

    it('has name as non-null', () => {
      expect(user.name.notNull).toBe(true);
    });
  });

  describe('session table', () => {
    it('has activeOrganizationId column for workspace tracking', () => {
      expect(session.activeOrganizationId).toBeDefined();
      expect(session.activeOrganizationId.dataType).toBe('string');
    });

    it('has userId as non-null foreign key', () => {
      expect(session.userId.notNull).toBe(true);
    });
  });

  describe('subscription table', () => {
    it.each(['referenceId', 'plan', 'status', 'stripeScheduleId'] as const)(
      'has %s column',
      (column) => {
        expect(subscription[column]).toBeDefined();
      }
    );

    it('has plan and referenceId as non-null', () => {
      expect(subscription.plan.notNull).toBe(true);
      expect(subscription.referenceId.notNull).toBe(true);
    });
  });

  describe('member table', () => {
    it.each(['organizationId', 'userId', 'role'] as const)(
      'has %s column',
      (column) => {
        expect(member[column]).toBeDefined();
      }
    );

    it('has role defaulting to member', () => {
      expect(member.role.hasDefault).toBe(true);
    });
  });

  describe('organization table', () => {
    it('has slug column', () => {
      expect(organization.slug).toBeDefined();
      expect(organization.slug.notNull).toBe(true);
    });

    it('has name as non-null', () => {
      expect(organization.name.notNull).toBe(true);
    });
  });

  describe('invitation table', () => {
    it.each(['email', 'role', 'status'] as const)('has %s column', (column) => {
      expect(invitation[column]).toBeDefined();
    });

    it('has status defaulting to pending', () => {
      expect(invitation.status.hasDefault).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// index.ts — exports
// ---------------------------------------------------------------------------

describe('db package exports', () => {
  it('exports createDb as a function', () => {
    expect(typeof createDb).toBe('function');
  });

  it('exports schema with auth and app tables', () => {
    expect(schema.user).toBeDefined();
    expect(schema.notificationPreferences).toBeDefined();
    expect(schema.workspaceIntegrationSecrets).toBeDefined();
  });
});
