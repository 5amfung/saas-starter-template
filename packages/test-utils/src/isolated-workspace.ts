import { VALID_PASSWORD } from './e2e-constants';
import { getE2EDb } from './e2e-db';
import { createSeededUser } from './seeded-user';
import { uniqueEmail } from './unique-email';
import { subscription } from '@/db/schema';

interface IsolatedWorkspaceOwnerOptions {
  email?: string;
  password?: string;
  name?: string;
}

interface CreateIsolatedWorkspaceFixtureOptions {
  owner?: IsolatedWorkspaceOwnerOptions;
  emailPrefix?: string;
  plan?: 'free' | 'starter' | 'pro';
}

export interface IsolatedWorkspaceFixture {
  owner: {
    userId: string;
    email: string;
    password: string;
    cookie: string;
  };
  workspaceId: string;
  workspace: {
    id: string;
  };
}

export async function ensureWorkspaceSubscription(
  workspaceId: string,
  plan: 'starter' | 'pro' = 'starter'
): Promise<void> {
  const db = getE2EDb();
  const existingSubscriptions = await db.query.subscription.findMany();
  const existingSubscription = existingSubscriptions.find(
    (entry) => entry.referenceId === workspaceId
  );

  if (existingSubscription) {
    return;
  }

  await db.insert(subscription).values({
    id: `e2e_subscription_${crypto.randomUUID().replace(/-/g, '')}`,
    plan,
    referenceId: workspaceId,
    status: 'active',
  });
}

export async function createIsolatedWorkspaceFixture(
  baseUrl: string,
  options: CreateIsolatedWorkspaceFixtureOptions = {}
): Promise<IsolatedWorkspaceFixture> {
  const ownerEmail = options.owner?.email ?? uniqueEmail(options.emailPrefix);
  const ownerPassword = options.owner?.password ?? VALID_PASSWORD;

  const result = await createSeededUser(baseUrl, {
    email: ownerEmail,
    password: ownerPassword,
    name: options.owner?.name,
  });

  if (options.plan && options.plan !== 'free') {
    await ensureWorkspaceSubscription(result.workspaceId, options.plan);
  }

  return {
    owner: {
      userId: result.userId,
      email: ownerEmail,
      password: ownerPassword,
      cookie: result.cookie,
    },
    workspaceId: result.workspaceId,
    workspace: {
      id: result.workspaceId,
    },
  };
}
