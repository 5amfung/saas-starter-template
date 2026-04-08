import { hashPassword } from 'better-auth/crypto';
import { createDb } from '@workspace/db';
import * as schema from '@workspace/db-schema';
import { account, member, organization, user } from '@workspace/db-schema';
import { signInSeededUser } from './e2e-auth';

interface CreateSeededUserOptions {
  email: string;
  password: string;
  name?: string;
}

interface CreateSeededUserResult {
  userId: string;
  workspaceId: string;
  cookie: string;
}

let dbSingleton: ReturnType<typeof createDb<typeof schema>> | null = null;

function loadEnvFileIfPresent(path: string): void {
  try {
    process.loadEnvFile?.(path);
  } catch {
    // Ignore missing env files and keep looking.
  }
}

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  loadEnvFileIfPresent(
    new URL('../../../apps/web/.env', import.meta.url).pathname
  );
  loadEnvFileIfPresent(
    new URL('../../../packages/db-schema/.env', import.meta.url).pathname
  );

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required to create seeded E2E users. Checked apps/web/.env and packages/db-schema/.env.'
    );
  }

  return process.env.DATABASE_URL;
}

function getDb() {
  dbSingleton ??= createDb(getDatabaseUrl(), schema);
  return dbSingleton;
}

export async function createSeededUser(
  baseUrl: string,
  options: CreateSeededUserOptions
): Promise<CreateSeededUserResult> {
  const db = getDb();
  const seedId = crypto.randomUUID().replace(/-/g, '');
  const now = new Date();
  const userId = `e2e_user_${seedId}`;
  const accountId = `e2e_account_${seedId}`;
  const workspaceId = `e2e_org_${seedId}`;
  const memberId = `e2e_member_${seedId}`;
  const workspaceSlug = `e2e-${seedId.slice(0, 12)}`;
  const passwordHash = await hashPassword(options.password);

  await db.insert(user).values({
    id: userId,
    name: options.name ?? options.email.split('@')[0] ?? 'E2E User',
    email: options.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    lastLoginMethod: 'email',
    banned: false,
  });

  await db.insert(account).values({
    id: accountId,
    accountId: userId,
    providerId: 'credential',
    userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(organization).values({
    id: workspaceId,
    name: 'My Workspace',
    slug: workspaceSlug,
    createdAt: now,
  });

  await db.insert(member).values({
    id: memberId,
    organizationId: workspaceId,
    userId,
    role: 'owner',
    createdAt: now,
  });

  const { cookie } = await signInSeededUser(baseUrl, {
    email: options.email,
    password: options.password,
  });

  return { userId, workspaceId, cookie };
}
