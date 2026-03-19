import { createDb } from "@workspace/db"
import { createEmailClient } from "@workspace/email"

export const db = createDb(process.env.DATABASE_URL!)

export const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
  appName: process.env.VITE_APP_NAME || "App",
  devPrefix: process.env.NODE_ENV !== "production",
})
