import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { createDb } from '@workspace/db';
import * as schema from '../schema';
import { account, member, organization, subscription, user } from '../schema';
import {
  E2E_ADMIN_ENTERPRISE_OWNER,
  E2E_ADMIN_FILTER_USERS,
  E2E_ADMIN_MUTATION_FIXTURES,
  E2E_ADMIN_WORKSPACES,
  E2E_BASELINE_USERS,
  E2E_PASSWORD,
  E2E_PLATFORM_ADMIN,
} from './e2e-fixtures';
import { resetE2EState } from './reset-e2e-state';

interface SeedE2EBaselineOptions {
  databaseUrl?: string;
}

const E2E_BASELINE_SEED_LOCK_ID = 2_026_040_7;

function resolveDatabaseUrl(databaseUrl?: string): string {
  if (databaseUrl) return databaseUrl;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  throw new Error('DATABASE_URL is required for seedE2EBaseline');
}

export async function seedE2EBaseline(
  options: SeedE2EBaselineOptions = {}
): Promise<void> {
  const db = createDb(resolveDatabaseUrl(options.databaseUrl), schema);
  const now = new Date();
  const banExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const baselineUsers = Object.values(E2E_BASELINE_USERS);
  const filterUsers = Object.values(E2E_ADMIN_FILTER_USERS);
  const mutationUsers = [
    E2E_ADMIN_MUTATION_FIXTURES.editableUser,
    E2E_ADMIN_MUTATION_FIXTURES.dangerousActionUser,
  ];
  const workspaceUsers = [
    ...baselineUsers,
    E2E_ADMIN_ENTERPRISE_OWNER,
    {
      userId: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerUserId,
      accountId: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerAccountId,
      organizationId:
        E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.organizationId,
      memberId: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerMemberId,
      email: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerEmail,
      name: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerName,
      role: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.role,
    },
  ];
  const credentialUsers = [
    ...workspaceUsers,
    ...filterUsers,
    ...mutationUsers,
    E2E_PLATFORM_ADMIN,
  ];

  await db.execute(sql`select pg_advisory_lock(${E2E_BASELINE_SEED_LOCK_ID})`);

  try {
    await resetE2EState({ db });

    await db.insert(user).values([
      {
        id: E2E_BASELINE_USERS.owner.userId,
        name: E2E_BASELINE_USERS.owner.name,
        email: E2E_BASELINE_USERS.owner.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: false,
      },
      {
        id: E2E_BASELINE_USERS.admin.userId,
        name: E2E_BASELINE_USERS.admin.name,
        email: E2E_BASELINE_USERS.admin.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: false,
      },
      {
        id: E2E_PLATFORM_ADMIN.userId,
        name: E2E_PLATFORM_ADMIN.name,
        email: E2E_PLATFORM_ADMIN.email,
        emailVerified: true,
        role: E2E_PLATFORM_ADMIN.role,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: false,
      },
      {
        id: E2E_BASELINE_USERS.member.userId,
        name: E2E_BASELINE_USERS.member.name,
        email: E2E_BASELINE_USERS.member.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: false,
      },
      {
        id: E2E_BASELINE_USERS.proOwner.userId,
        name: E2E_BASELINE_USERS.proOwner.name,
        email: E2E_BASELINE_USERS.proOwner.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: false,
      },
      {
        id: E2E_ADMIN_ENTERPRISE_OWNER.userId,
        name: E2E_ADMIN_ENTERPRISE_OWNER.name,
        email: E2E_ADMIN_ENTERPRISE_OWNER.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: false,
      },
      {
        id: E2E_ADMIN_FILTER_USERS.verified.userId,
        name: E2E_ADMIN_FILTER_USERS.verified.name,
        email: E2E_ADMIN_FILTER_USERS.verified.email,
        emailVerified: E2E_ADMIN_FILTER_USERS.verified.emailVerified,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: E2E_ADMIN_FILTER_USERS.verified.banned,
      },
      {
        id: E2E_ADMIN_FILTER_USERS.unverified.userId,
        name: E2E_ADMIN_FILTER_USERS.unverified.name,
        email: E2E_ADMIN_FILTER_USERS.unverified.email,
        emailVerified: E2E_ADMIN_FILTER_USERS.unverified.emailVerified,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: E2E_ADMIN_FILTER_USERS.unverified.banned,
      },
      {
        id: E2E_ADMIN_FILTER_USERS.banned.userId,
        name: E2E_ADMIN_FILTER_USERS.banned.name,
        email: E2E_ADMIN_FILTER_USERS.banned.email,
        emailVerified: E2E_ADMIN_FILTER_USERS.banned.emailVerified,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: E2E_ADMIN_FILTER_USERS.banned.banned,
        banReason: E2E_ADMIN_FILTER_USERS.banned.banReason,
        banExpires,
      },
      {
        id: E2E_ADMIN_MUTATION_FIXTURES.editableUser.userId,
        name: E2E_ADMIN_MUTATION_FIXTURES.editableUser.name,
        email: E2E_ADMIN_MUTATION_FIXTURES.editableUser.email,
        emailVerified: E2E_ADMIN_MUTATION_FIXTURES.editableUser.emailVerified,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: E2E_ADMIN_MUTATION_FIXTURES.editableUser.banned,
      },
      {
        id: E2E_ADMIN_MUTATION_FIXTURES.dangerousActionUser.userId,
        name: E2E_ADMIN_MUTATION_FIXTURES.dangerousActionUser.name,
        email: E2E_ADMIN_MUTATION_FIXTURES.dangerousActionUser.email,
        emailVerified:
          E2E_ADMIN_MUTATION_FIXTURES.dangerousActionUser.emailVerified,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: E2E_ADMIN_MUTATION_FIXTURES.dangerousActionUser.banned,
      },
      {
        id: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerUserId,
        name: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerName,
        email: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.ownerEmail,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        lastLoginMethod: 'email',
        banned: false,
      },
    ]);

    await db.insert(account).values(
      credentialUsers.map((entry) => ({
        id: entry.accountId,
        accountId: entry.userId,
        providerId: 'credential',
        userId: entry.userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      }))
    );

    await db.insert(organization).values([
      {
        id: E2E_BASELINE_USERS.owner.organizationId,
        name: E2E_BASELINE_USERS.owner.organizationName,
        slug: E2E_BASELINE_USERS.owner.organizationSlug,
        createdAt: now,
      },
      {
        id: E2E_BASELINE_USERS.proOwner.organizationId,
        name: E2E_BASELINE_USERS.proOwner.organizationName,
        slug: E2E_BASELINE_USERS.proOwner.organizationSlug,
        createdAt: now,
      },
      {
        id: E2E_ADMIN_ENTERPRISE_OWNER.organizationId,
        name: E2E_ADMIN_ENTERPRISE_OWNER.organizationName,
        slug: E2E_ADMIN_ENTERPRISE_OWNER.organizationSlug,
        createdAt: now,
      },
      {
        id: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.organizationId,
        name: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.name,
        slug: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.slug,
        createdAt: now,
      },
    ]);

    await db.insert(member).values(
      workspaceUsers.map((entry) => ({
        id: entry.memberId,
        organizationId: entry.organizationId,
        userId: entry.userId,
        role: entry.role,
        createdAt: now,
      }))
    );

    await db.insert(subscription).values({
      id: 'e2e_subscription_pro_owner',
      plan: 'pro',
      referenceId: E2E_BASELINE_USERS.proOwner.organizationId,
      status: 'active',
    });

    await db.insert(subscription).values({
      id: 'e2e_subscription_enterprise_owner',
      plan: E2E_ADMIN_WORKSPACES.enterprise.planId,
      referenceId: E2E_ADMIN_ENTERPRISE_OWNER.organizationId,
      status: 'active',
    });

    await db.insert(subscription).values({
      id: 'e2e_subscription_admin_mutation_enterprise',
      plan: E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.planId,
      referenceId:
        E2E_ADMIN_MUTATION_FIXTURES.enterpriseWorkspace.organizationId,
      status: 'active',
    });
  } finally {
    await db.execute(
      sql`select pg_advisory_unlock(${E2E_BASELINE_SEED_LOCK_ID})`
    );
  }
}
