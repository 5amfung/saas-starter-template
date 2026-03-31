import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import { admin, lastLoginMethod } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { eq } from 'drizzle-orm';
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
  verification as verificationTable,
} from './admin-auth.schema';
import { createAdminAuthEmails } from './admin-auth-emails.server';
import { isSignInPath } from './auth-utils';
import type { AdminDatabase } from '@/db';
import type { EmailClient } from '@workspace/email';

export interface AdminAuthConfig {
  db: AdminDatabase;
  emailClient: EmailClient;
  baseUrl: string;
  secret: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  trustedOrigins?: Array<string>;
  logger?: (
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ) => void | Promise<void>;
  getRequestHeaders?: () => Headers;
}

export function createAdminAuth(config: AdminAuthConfig) {
  const authEmails = createAdminAuthEmails({
    emailClient: config.emailClient,
    getRequestHeaders: config.getRequestHeaders,
    baseUrl: config.baseUrl,
  });

  const auth = betterAuth({
    telemetry: { enabled: false },
    trustedOrigins: config.trustedOrigins ?? ['http://localhost:3001'],
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        trustedProviders: ['google'],
      },
    },
    database: drizzleAdapter(config.db, {
      provider: 'pg',
      schema: {
        user: userTable,
        session: sessionTable,
        account: accountTable,
        verification: verificationTable,
      },
    }),
    user: {
      modelName: 'admin_user',
      additionalFields: {
        lastSignInAt: {
          type: 'date',
          required: false,
          input: false,
        },
      },
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: authEmails.sendChangeEmailConfirmation,
      },
    },
    session: {
      modelName: 'admin_session',
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 600,
      sendResetPassword: authEmails.sendResetPasswordEmail,
    },
    emailVerification: {
      sendOnSignIn: true,
      expiresIn: 600,
      autoSignInAfterVerification: true,
      sendVerificationEmail: authEmails.sendVerificationEmail,
    },
    socialProviders: {
      google: {
        prompt: 'select_account consent',
        accessType: 'offline',
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!isSignInPath(ctx.path)) return;
        const newSession = ctx.context.newSession;
        if (!newSession) return;

        await config.db
          .update(userTable)
          .set({ lastSignInAt: new Date() })
          .where(eq(userTable.id, newSession.user.id));
      }),
    },
    plugins: [
      lastLoginMethod({ storeInDatabase: true }),
      admin({}),
      tanstackStartCookies(),
    ],
  });

  return auth;
}

export type AdminAuth = ReturnType<typeof createAdminAuth>;
