import { eq } from 'drizzle-orm';
import { createDb } from '@workspace/db';
import { user as userTable } from '@workspace/db-schema';
import * as schema from '@workspace/db-schema';
import { createVerifiedUser } from '@workspace/test-utils';

let db: ReturnType<typeof createDb> | null = null;

function getDb(): ReturnType<typeof createDb> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required to promote Admin E2E users to admin.'
    );
  }

  db ??= createDb(databaseUrl, schema);
  return db;
}

export async function drain(response: Response): Promise<void> {
  await response.body?.cancel();
}

export async function createVerifiedAdminCandidate(options: {
  baseUrl: string;
  email: string;
  password: string;
}) {
  const { baseUrl, ...userOptions } = options;
  return createVerifiedUser(baseUrl, userOptions);
}

export async function promoteUserToAdmin(userId: string): Promise<void> {
  await getDb()
    .update(userTable)
    .set({ role: 'admin' })
    .where(eq(userTable.id, userId));
}
