import { createElement } from 'react';
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
import { buildEmailRequestContext } from '@/email/email-request-context.server';
import { APP_NAME, sendEmail } from '@/email/resend.server';
import { ChangeEmailApprovalEmail } from '@/components/email-template/change-email-approval-email';
import { EmailVerificationEmail } from '@/components/email-template/email-verification-email';
import { ResetPasswordEmail } from '@/components/email-template/reset-password-email';
import {
  PERSONAL_WORKSPACE_NAME,
  buildPersonalWorkspaceSlug,
  createPersonalWorkspaceMetadata,
  isPersonalWorkspace,
  pickDefaultWorkspace,
} from '@/workspace/workspace';

const isSignInPath = (path: string) =>
  path.startsWith('/sign-in') || path.startsWith('/callback/');

const isDuplicateOrganizationError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.toLowerCase().includes('already exists') ||
    error.message.toLowerCase().includes('duplicate') ||
    error.message.toLowerCase().includes('unique'));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type SessionLike = {
  activeOrganizationId?: unknown;
};

const hasActiveOrganization = (session: SessionLike): boolean =>
  typeof session.activeOrganizationId === 'string';

type OrganizationLike = {
  id: string;
  name: string;
  metadata?: unknown;
};

const normalizeOrganizationList = (value: unknown): Array<OrganizationLike> => {
  const toOrganization = (candidate: unknown): OrganizationLike | null => {
    if (!isRecord(candidate)) return null;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string'
    ) {
      return null;
    }
    return {
      id: candidate.id,
      name: candidate.name,
      metadata: candidate.metadata,
    };
  };

  if (Array.isArray(value)) {
    return value
      .map((candidate) => toOrganization(candidate))
      .filter((candidate): candidate is OrganizationLike => candidate !== null);
  }

  if (isRecord(value) && Array.isArray(value.organizations)) {
    return value.organizations
      .map((candidate) => toOrganization(candidate))
      .filter((candidate): candidate is OrganizationLike => candidate !== null);
  }

  return [];
};

async function ensurePostSignInActiveWorkspace(params: {
  userId: string;
  session: SessionLike;
  headers?: Headers;
}): Promise<void> {
  if (hasActiveOrganization(params.session)) return;
  if (!params.headers) return;

  try {
    const organizations = normalizeOrganizationList(
      await auth.api.listOrganizations({ headers: params.headers }),
    );
    const targetWorkspace = pickDefaultWorkspace(organizations, params.userId);

    if (!targetWorkspace) return;

    await auth.api.setActiveOrganization({
      body: { organizationId: targetWorkspace.id },
      headers: params.headers,
    });
  } catch {
    // Do not block sign-in; middleware will retry active workspace setup.
    return;
  }
}

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

      // Store last sign-in time in database.
      await db
        .update(userTable)
        .set({ lastSignInAt: new Date() })
        .where(eq(userTable.id, newSession.user.id));

      const headers = ctx.headers instanceof Headers ? ctx.headers : undefined;
      await ensurePostSignInActiveWorkspace({
        userId: newSession.user.id,
        session: newSession.session as SessionLike,
        headers,
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
                metadata: createPersonalWorkspaceMetadata(user.id),
                userId: user.id,
              },
            });
          } catch (error) {
            if (!isDuplicateOrganizationError(error)) throw error;
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
      organizationHooks: {
        beforeDeleteOrganization: async ({ organization }) => {
          if (isPersonalWorkspace(organization.metadata)) {
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
