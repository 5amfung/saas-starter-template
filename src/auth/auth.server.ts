import { createElement } from 'react';
import { betterAuth } from 'better-auth';
import { admin, emailOTP } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from '@/db';
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
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        react: createElement(ResetPasswordEmail, {
          appName: APP_NAME,
          resetUrl: url,
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignIn: true,
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
        await sendEmail({
          to: email,
          subject: 'Verify your account',
          react: createElement(VerificationCodeEmail, {
            appName: APP_NAME,
            otp,
          }),
        });
      },
    }),
    tanstackStartCookies(),
  ],
});
