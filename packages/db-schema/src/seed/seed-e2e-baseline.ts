import { hashPassword } from 'better-auth/crypto';
import { inArray } from 'drizzle-orm';
import { createDb } from '@workspace/db';
import * as schema from '../schema';
import { account, member, organization, subscription, user } from '../schema';
import { E2E_BASELINE_USERS, E2E_PASSWORD } from './e2e-fixtures';

interface SeedE2EBaselineOptions {
  databaseUrl?: string;
}

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
  const passwordHash = await hashPassword(E2E_PASSWORD);

  const baselineUsers = Object.values(E2E_BASELINE_USERS);
  const userIds = baselineUsers.map((entry) => entry.userId);
  const organizationIds = Array.from(
    new Set(baselineUsers.map((entry) => entry.organizationId))
  );

  await db
    .delete(subscription)
    .where(inArray(subscription.referenceId, organizationIds));
  await db.delete(member).where(inArray(member.userId, userIds));
  await db
    .delete(organization)
    .where(inArray(organization.id, organizationIds));
  await db.delete(account).where(inArray(account.userId, userIds));
  await db.delete(user).where(inArray(user.id, userIds));

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
  ]);

  await db.insert(account).values(
    baselineUsers.map((entry) => ({
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
  ]);

  await db.insert(member).values(
    baselineUsers.map((entry) => ({
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
}
