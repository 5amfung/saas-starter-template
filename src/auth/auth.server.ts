import { betterAuth } from 'better-auth';
import { admin, emailOTP } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from '@/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      // TODO: Replace with actual email service.
      console.log(`Reset password for ${user.email}: ${url}, token: ${token}`);
      await Promise.resolve();
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
      async sendVerificationOTP({ email, otp, type }) {
        // TODO: Replace with actual email service (e.g. await emailService.send(...)).
        console.log(`[${type}] OTP for ${email}: ${otp}`);
        await Promise.resolve();
      },
    }),
    tanstackStartCookies(),
  ],
});
