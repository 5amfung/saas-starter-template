import { redirect } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { eq } from 'drizzle-orm';
import { notificationPreferences } from '@workspace/db-schema';
import type {
  NotificationPreferences,
  NotificationPreferencesPatch,
} from '@/account/notification-preferences.schemas';
import { auth, db } from '@/init';

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailUpdates: true,
  marketingEmails: false,
};

export async function requireVerifiedSession() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  return session;
}

export async function getNotificationPreferencesForUser(
  userId: string
): Promise<NotificationPreferences> {
  const row = (
    await db
      .select({ marketingEmails: notificationPreferences.marketingEmails })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1)
  ).at(0);

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    marketingEmails:
      row?.marketingEmails ?? DEFAULT_NOTIFICATION_PREFERENCES.marketingEmails,
  };
}

export async function upsertNotificationPreferencesForUser(
  userId: string,
  patch: NotificationPreferencesPatch
): Promise<NotificationPreferences> {
  if (typeof patch.marketingEmails !== 'boolean') {
    return getNotificationPreferencesForUser(userId);
  }

  await db
    .insert(notificationPreferences)
    .values({
      userId,
      marketingEmails: patch.marketingEmails,
    })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        marketingEmails: patch.marketingEmails,
        updatedAt: new Date(),
      },
    });

  return getNotificationPreferencesForUser(userId);
}
