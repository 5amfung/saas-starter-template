import { getRequestHeaders } from '@tanstack/react-start/server';
import { createDb } from '@/db/client';
import * as schema from '@/db/schema';
import { createEmailClient, createMockEmailClient } from '@/email';
import { createAuth } from '@/auth/server/auth.server';

let dbSingleton: ReturnType<typeof createDb> | undefined;
let emailClientSingleton:
  | ReturnType<typeof createEmailClient>
  | ReturnType<typeof createMockEmailClient>
  | undefined;
let authSingleton: ReturnType<typeof createAuth> | undefined;

export function getDb() {
  if (!dbSingleton) {
    dbSingleton = createDb(process.env.DATABASE_URL!, schema);
  }

  return dbSingleton;
}

// E2E_MOCK_EMAIL is inlined at build time by Nitro's rollupConfig.define
// (see vite.config.ts). Production builds replace it with "" so Rollup
// tree-shakes the mock branch entirely. The `build:e2e` script sets it
// to "true", keeping the mock email client in the E2E bundle.
export function getEmailClient() {
  if (!emailClientSingleton) {
    emailClientSingleton =
      process.env.E2E_MOCK_EMAIL === 'true'
        ? createMockEmailClient({ appName: process.env.VITE_APP_NAME || 'App' })
        : createEmailClient({
            apiKey: process.env.RESEND_API_KEY!,
            fromEmail: process.env.RESEND_FROM_EMAIL!,
            replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
            appName: process.env.VITE_APP_NAME || 'App',
            devPrefix: process.env.NODE_ENV !== 'production',
          });
  }

  return emailClientSingleton;
}

export function getAuth() {
  if (!authSingleton) {
    authSingleton = createAuth({
      db: getDb(),
      emailClient: getEmailClient(),
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
      getRequestHeaders,
    });
  }

  return authSingleton;
}
