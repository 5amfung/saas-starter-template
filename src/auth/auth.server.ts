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
import { WorkspaceInvitationEmail } from '@/components/email-template/workspace-invitation-email';
import {
  PERSONAL_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
  buildPersonalWorkspaceSlug,
  isPersonalWorkspace,
  pickDefaultWorkspace,
} from '@/workspace/workspace';

const WORKSPACE_TYPES = [
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
] as const;
type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

const isWorkspaceType = (value: unknown): value is WorkspaceType =>
  typeof value === 'string' &&
  (WORKSPACE_TYPES as ReadonlyArray<string>).includes(value);

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const validateWorkspaceFields = (
  organization: Record<string, unknown>,
  context: 'create' | 'update',
) => {
  const workspaceType = organization.workspaceType;
  const personalOwnerUserId = asOptionalString(
    organization.personalOwnerUserId,
  );

  if (workspaceType !== undefined && !isWorkspaceType(workspaceType)) {
    throw new APIError('BAD_REQUEST', {
      message: 'workspaceType must be personal or workspace',
    });
  }

  if (workspaceType === PERSONAL_WORKSPACE_TYPE && !personalOwnerUserId) {
    throw new APIError('BAD_REQUEST', {
      message: 'personalOwnerUserId is required for personal workspaces',
    });
  }

  if (context === 'create' && workspaceType === undefined) {
    throw new APIError('BAD_REQUEST', {
      message: 'workspaceType is required',
    });
  }

  if (
    context === 'update' &&
    personalOwnerUserId &&
    workspaceType === STANDARD_WORKSPACE_TYPE
  ) {
    throw new APIError('BAD_REQUEST', {
      message: 'personalOwnerUserId is not allowed for workspace type',
    });
  }
};

const isSignInPath = (path: string) =>
  path.startsWith('/sign-in') || path.startsWith('/callback/');

const isDuplicateOrganizationError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.toLowerCase().includes('already exists') ||
    error.message.toLowerCase().includes('duplicate') ||
    error.message.toLowerCase().includes('unique'));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const ensureTrailingSlashRemoved = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

const resolveAppOrigin = (): string => {
  const baseUrl =
    process.env.BETTER_AUTH_URL && process.env.BETTER_AUTH_URL.trim() !== ''
      ? process.env.BETTER_AUTH_URL.trim()
      : 'http://localhost:3000';
  return ensureTrailingSlashRemoved(baseUrl);
};

const buildAcceptInviteUrl = (invitationId: string): string => {
  const origin = resolveAppOrigin();
  return `${origin}/accept-invite?id=${encodeURIComponent(invitationId)}`;
};

type SessionLike = {
  activeOrganizationId?: unknown;
};

const hasActiveOrganization = (session: SessionLike): boolean =>
  typeof session.activeOrganizationId === 'string';

async function ensurePostSignInActiveWorkspace(params: {
  userId: string;
  session: SessionLike;
  headers?: Headers;
}): Promise<void> {
  if (hasActiveOrganization(params.session)) return;
  if (!params.headers) return;

  try {
    const organizations = await auth.api.listOrganizations({
      headers: params.headers,
    });
    const targetWorkspace = pickDefaultWorkspace(organizations, params.userId);

    if (!targetWorkspace) return;

    await auth.api.setActiveOrganization({
      body: { organizationId: targetWorkspace.id },
      headers: params.headers,
    });
  } catch {
    return;
  }
}

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
      sendInvitationEmail: async (data) => {
        await sendEmail({
          to: data.email,
          subject: `Join ${data.organization.name} on ${APP_NAME}`,
          react: createElement(WorkspaceInvitationEmail, {
            appName: APP_NAME,
            workspaceName: data.organization.name,
            inviterEmail: data.inviter.user.email,
            invitationUrl: buildAcceptInviteUrl(data.id),
          }),
        });
      },
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
