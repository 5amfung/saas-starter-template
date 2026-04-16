import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { createDb } from '@workspace/db';
import * as schema from '../schema';
import { account, member, organization, subscription, user } from '../schema';
import {
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
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const baselineUsers = Object.values(E2E_BASELINE_USERS);
  const credentialUsers = [...baselineUsers, E2E_PLATFORM_ADMIN];

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
  } finally {
    await db.execute(
      sql`select pg_advisory_unlock(${E2E_BASELINE_SEED_LOCK_ID})`
    );
  }
}
