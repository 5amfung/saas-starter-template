import { getRequestHeaders } from '@tanstack/react-start/server';
import { createAuth } from '@workspace/auth/server';
import { createDb } from '@workspace/db';
import * as schema from '@workspace/db-schema';
import { createEmailClient, createMockEmailClient } from '@workspace/email';
import { logger } from '@/lib/logger';

export const db = createDb(process.env.DATABASE_URL!, schema);

// E2E_MOCK_EMAIL is inlined at build time by Nitro's rollupConfig.define
// (see vite.config.ts). Production builds replace it with "" so Rollup
// tree-shakes the mock branch entirely. The `build:e2e` script sets it
// to "true", keeping the mock email client in the E2E bundle.
export const emailClient =
  process.env.E2E_MOCK_EMAIL === 'true'
    ? createMockEmailClient({ appName: process.env.VITE_APP_NAME || 'App' })
    : createEmailClient({
        apiKey: process.env.RESEND_API_KEY!,
        fromEmail: process.env.RESEND_FROM_EMAIL!,
        replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
        appName: process.env.VITE_APP_NAME || 'App',
        devPrefix: process.env.NODE_ENV !== 'production',
      });

export const auth = createAuth({
  db,
  emailClient,
  baseUrl: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  logger,
  getRequestHeaders,
});
