import { VALID_PASSWORD } from './e2e-constants';
import { createSeededUser } from './seeded-user';
import { uniqueEmail } from './unique-email';

interface IsolatedWorkspaceOwnerOptions {
  email?: string;
  password?: string;
  name?: string;
}

interface CreateIsolatedWorkspaceFixtureOptions {
  owner?: IsolatedWorkspaceOwnerOptions;
  emailPrefix?: string;
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
