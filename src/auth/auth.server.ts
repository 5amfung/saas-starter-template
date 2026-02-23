import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import {
  admin,
  lastLoginMethod,
  organization as organizationPlugin,
} from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { user as userTable } from '@/db/schema';
import {
  PERSONAL_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_TYPE,
  buildPersonalWorkspaceSlug,
  isPersonalWorkspace,
} from '@/workspace/workspace';
import { isRecord, validateWorkspaceFields } from './auth-workspace.server';
import {
  sendChangeEmailConfirmation,
  sendInvitationEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from './auth-emails.server';
import {
  ensurePostSignInActiveWorkspace,
  isDuplicateOrganizationError,
  isSignInPath,
} from './auth-hooks.server';
import type { SessionLike } from './auth-hooks.server';

export const auth = betterAuth({
  telemetry: {
    enabled: false,
  },
  trustedOrigins: [
    // TODO: Whitlist domains.
    // Requests from origins not on this list are automatically blocked
    // https://www.better-auth.com/docs/reference/security#trusted-origins
    'http://localhost:3000',
  ],
  rateLimit: {
    enabled: true,
    window: 60, // 60 second window
    max: 10, // max 10 attempts
  },
  account: {
    accountLinking: {
      trustedProviders: ['google'],
    },
  },
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
      sendChangeEmailConfirmation,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 600, // in seconds
    sendResetPassword: sendResetPasswordEmail,
  },
  emailVerification: {
    sendOnSignIn: true,
    expiresIn: 600, // in seconds
    autoSignInAfterVerification: true,
    emailAndPassword: {
      requireEmailVerification: true,
    },
    sendVerificationEmail,
  },
  socialProviders: {
    google: {
      prompt: 'select_account consent',
      accessType: 'offline',
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

      const headers = ctx.headers instanceof Headers ? ctx.headers : undefined;
      await ensurePostSignInActiveWorkspace({
        userId: newSession.user.id,
        session: newSession.session as unknown as SessionLike,
        headers,
        listOrganizations: auth.api.listOrganizations,
        setActiveOrganization: auth.api.setActiveOrganization,
      });
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await auth.api.createOrganization({
              body: {
                name: PERSONAL_WORKSPACE_NAME,
                slug: buildPersonalWorkspaceSlug(user.id),
                workspaceType: PERSONAL_WORKSPACE_TYPE,
                personalOwnerUserId: user.id,
                userId: user.id,
              },
            });
          } catch (error) {
            if (!isDuplicateOrganizationError(error)) {
              console.error(error);
              throw error;
            }
          }
        },
      },
    },
  },
  plugins: [
    lastLoginMethod({
      storeInDatabase: true,
    }),
    organizationPlugin({
      allowUserToCreateOrganization: true,
      creatorRole: 'owner',
      requireEmailVerificationOnInvitation: true,
      sendInvitationEmail,
      schema: {
        organization: {
          additionalFields: {
            workspaceType: {
              type: 'string',
              input: true,
              required: false,
            },
            personalOwnerUserId: {
              type: 'string',
              input: true,
              required: false,
            },
          },
        },
      },
      organizationHooks: {
        beforeCreateOrganization: async ({ organization }) => {
          if (!isRecord(organization)) return;
          validateWorkspaceFields(organization, 'create');
          await Promise.resolve();
        },
        beforeUpdateOrganization: async ({ organization }) => {
          if (!isRecord(organization)) return;
          validateWorkspaceFields(organization, 'update');
          await Promise.resolve();
        },
        beforeDeleteOrganization: async ({ organization }) => {
          if (isPersonalWorkspace(organization)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Personal workspace can not be deleted',
            });
          }
          await Promise.resolve();
        },
      },
    }),
    admin({
      adminUserIds: [
        // Whitelist user ID as admin here.
      ],
    }),
    tanstackStartCookies(),
  ],
});
