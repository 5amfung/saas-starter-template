import { inArray, like, or } from 'drizzle-orm';
import { createDb } from '@workspace/db';
import {
  member,
  organization,
  subscription,
  user,
  verification,
} from '../schema';
import * as schema from '../schema';

interface ResetE2EStateOptions {
  databaseUrl?: string;
  db?: ReturnType<typeof createDb<typeof schema>>;
}

function resolveDatabaseUrl(databaseUrl?: string): string {
  if (databaseUrl) return databaseUrl;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  throw new Error('DATABASE_URL is required for resetE2EState');
}

function uniqueStrings(
  values: Array<string | null | undefined>
): Array<string> {
  return Array.from(
    new Set(values.filter((value): value is string => !!value))
  );
}

export async function resetE2EState(
  options: ResetE2EStateOptions = {}
): Promise<void> {
  const db =
    options.db ?? createDb(resolveDatabaseUrl(options.databaseUrl), schema);

  const e2eUsers = await db
    .select({
      id: user.id,
      email: user.email,
    })
    .from(user)
    .where(or(like(user.id, 'e2e_user_%'), like(user.email, '%@e2e.local')));

  const userIds = uniqueStrings(e2eUsers.map((entry) => entry.id));
  const emails = uniqueStrings(e2eUsers.map((entry) => entry.email));

  const memberWorkspaceIds =
    userIds.length === 0
      ? []
      : await db
          .select({
            organizationId: member.organizationId,
          })
          .from(member)
          .where(inArray(member.userId, userIds));

  const prefixedOrganizations = await db
    .select({
      id: organization.id,
    })
    .from(organization)
    .where(
      or(like(organization.id, 'e2e_org_%'), like(organization.slug, 'e2e-%'))
    );

  const organizationIds = uniqueStrings([
    ...memberWorkspaceIds.map((entry) => entry.organizationId),
    ...prefixedOrganizations.map((entry) => entry.id),
  ]);

  if (emails.length > 0) {
    await db
      .delete(verification)
      .where(inArray(verification.identifier, emails));
  }

  if (organizationIds.length > 0) {
    await db
      .delete(subscription)
      .where(inArray(subscription.referenceId, organizationIds));
    await db
      .delete(organization)
      .where(inArray(organization.id, organizationIds));
  }

  if (userIds.length > 0) {
    await db.delete(user).where(inArray(user.id, userIds));
  }
}
