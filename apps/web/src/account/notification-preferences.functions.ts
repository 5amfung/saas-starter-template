import { createServerFn } from "@tanstack/react-start"
import { updateNotificationPreferencesInput } from "@/account/notification-preferences.schemas"
import {
  getNotificationPreferencesForUser,
  requireVerifiedSession,
  upsertNotificationPreferencesForUser,
} from "@/account/notification-preferences.server"

export const getNotificationPreferences = createServerFn().handler(async () => {
  const session = await requireVerifiedSession()
  return getNotificationPreferencesForUser(session.user.id)
})

export const updateNotificationPreferences = createServerFn()
  .inputValidator(updateNotificationPreferencesInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession()
    return upsertNotificationPreferencesForUser(session.user.id, data)
  })
