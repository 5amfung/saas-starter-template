import { createElement } from 'react';
import { betterAuth } from 'better-auth';
import { admin, emailOTP } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from '@/db';
import { buildEmailRequestContext } from '@/email/email-request-context.server';
import { APP_NAME, sendEmail } from '@/email/resend.server';
import { ResetPasswordEmail } from '@/components/email-template/reset-password-email';
import { VerificationCodeEmail } from '@/components/email-template/verification-code-email';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
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
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    admin({
      adminUserIds: [
        // Add admin user ID here.
      ],
    }),
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp }) {
        const requestContext = buildEmailRequestContext();
        await sendEmail({
          to: email,
          subject: `${otp} is your verification code`,
          react: createElement(VerificationCodeEmail, {
            appName: APP_NAME,
            otp,
            requestContext,
          }),
        });
      },
    }),
    tanstackStartCookies(),
  ],
});
