import { getRequestHeaders } from '@tanstack/react-start/server';
import { createEmailClient, createMockEmailClient } from '@workspace/email';
import { createDb } from '@workspace/db';
import * as schema from '@workspace/admin-db-schema';
import { createAdminAuth } from '@/auth/admin-auth.server';
import { logger } from '@/lib/logger';

export const db = createDb(process.env.DATABASE_URL!, schema);

export const emailClient =
  process.env.E2E_MOCK_EMAIL === 'true'
    ? createMockEmailClient({ appName: process.env.VITE_APP_NAME || 'Admin' })
    : createEmailClient({
        apiKey: process.env.RESEND_API_KEY!,
        fromEmail: process.env.RESEND_FROM_EMAIL!,
        replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
        appName: process.env.VITE_APP_NAME || 'Admin',
        devPrefix: process.env.NODE_ENV !== 'production',
      });

export const auth = createAdminAuth({
  db,
  emailClient,
  baseUrl: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  logger,
  getRequestHeaders,
});
