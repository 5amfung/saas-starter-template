import { createElement } from 'react';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { admin, lastLoginMethod } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { user as userTable } from '@/db/schema';
import { buildEmailRequestContext } from '@/email/email-request-context.server';
import { APP_NAME, sendEmail } from '@/email/resend.server';
import { ChangeEmailApprovalEmail } from '@/components/email-template/change-email-approval-email';
import { EmailVerificationEmail } from '@/components/email-template/email-verification-email';
import { ResetPasswordEmail } from '@/components/email-template/reset-password-email';

const isSignInPath = (path: string) =>
  path.startsWith('/sign-in') || path.startsWith('/callback/');

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  user: {
    additionalFields: {
      lastSignInAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        const requestContext = buildEmailRequestContext();
        await sendEmail({
          to: user.email,
          subject: 'Approve your email change',
          react: createElement(ChangeEmailApprovalEmail, {
            appName: APP_NAME,
            newEmail,
            approvalUrl: url,
            requestContext,
          }),
        });
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 600, // in seconds
    sendResetPassword: async ({ user, url }) => {
      const requestContext = buildEmailRequestContext();
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        react: createElement(ResetPasswordEmail, {
          appName: APP_NAME,
          resetUrl: url,
          requestContext,
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignIn: true,
    expiresIn: 600, // in seconds
    autoSignInAfterVerification: true,
    emailAndPassword: {
      requireEmailVerification: true,
    },
    sendVerificationEmail: async ({ user, url }) => {
      const requestContext = buildEmailRequestContext();
      await sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        react: createElement(EmailVerificationEmail, {
          appName: APP_NAME,
          verificationUrl: url,
          requestContext,
        }),
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (!isSignInPath(ctx.path)) return;
      const newSession = ctx.context.newSession;
      if (!newSession) return;
      await db
        .update(userTable)
        .set({ lastSignInAt: new Date() })
        .where(eq(userTable.id, newSession.user.id));
    }),
  },
  plugins: [
    lastLoginMethod({
      storeInDatabase: true,
    }),
    admin({
      adminUserIds: [
        // Whitelist user ID as admin here.
      ],
    }),
    tanstackStartCookies(),
  ],
});
