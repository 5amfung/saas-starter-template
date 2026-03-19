import * as z from "zod"

export const updateNotificationPreferencesInput = z
  .object({
    marketingEmails: z.boolean().optional(),
  })
  .strict()

export const notificationPreferencesSchema = z.object({
  emailUpdates: z.literal(true),
  marketingEmails: z.boolean(),
})

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>

export type NotificationPreferencesPatch = z.infer<
  typeof updateNotificationPreferencesInput
>
