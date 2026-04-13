import { createServerFn } from '@tanstack/react-start';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@workspace/logging/server';
import {
  adminDeleteUserSchema,
  adminGetUserSchema,
  adminListUsersSchema,
  adminUpdateUserSchema,
} from './users.schemas';
import {
  deleteAdminUser,
  getAdminUserDetail,
  listAdminUsers,
  updateAdminUser,
} from './users.server';
import { requireCurrentAdminAppCapability } from '@/policy/admin-app-capabilities.server';

const ADMIN_USERS_ROUTE = '/users/$userId';

function buildAdminUserWorkflowAttributes(
  operation:
    | typeof OPERATIONS.ADMIN_USER_UPDATE
    | typeof OPERATIONS.ADMIN_USER_DELETE,
  attributes: {
    targetUserId: string;
    result: 'attempt' | 'success' | 'failure';
    failureCategory?: string;
  }
) {
  return buildWorkflowAttributes(operation, {
    route: ADMIN_USERS_ROUTE,
    ...attributes,
  });
}

export const listUsers = createServerFn()
  .inputValidator(adminListUsersSchema)
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canViewUsers');
    return listAdminUsers(data);
  });

export const getUser = createServerFn()
  .inputValidator(adminGetUserSchema)
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canViewUsers');
    return getAdminUserDetail(data.userId);
  });

export const updateUser = createServerFn()
  .inputValidator(adminUpdateUserSchema)
  .handler(async ({ data }) => {
    return startWorkflowSpan(
      {
        op: OPERATIONS.ADMIN_USER_UPDATE,
        name: 'Update admin user',
        attributes: buildAdminUserWorkflowAttributes(
          OPERATIONS.ADMIN_USER_UPDATE,
          {
            targetUserId: data.userId,
            result: 'attempt',
          }
        ),
      },
      async () => {
        try {
          await requireCurrentAdminAppCapability('canManageUsers');
          const result = await updateAdminUser(data);
          workflowLogger.info('Admin user updated', {
            ...buildAdminUserWorkflowAttributes(OPERATIONS.ADMIN_USER_UPDATE, {
              targetUserId: data.userId,
              result: 'success',
            }),
          });
          return result;
        } catch (error) {
          workflowLogger.error('Admin user update failed', {
            ...buildAdminUserWorkflowAttributes(OPERATIONS.ADMIN_USER_UPDATE, {
              targetUserId: data.userId,
              result: 'failure',
              failureCategory: 'mutation_failed',
            }),
          });
          throw error;
        }
      }
    );
  });

export const deleteUser = createServerFn()
  .inputValidator(adminDeleteUserSchema)
  .handler(async ({ data }) => {
    return startWorkflowSpan(
      {
        op: OPERATIONS.ADMIN_USER_DELETE,
        name: 'Delete admin user',
        attributes: buildAdminUserWorkflowAttributes(
          OPERATIONS.ADMIN_USER_DELETE,
          {
            targetUserId: data.userId,
            result: 'attempt',
          }
        ),
      },
      async () => {
        try {
          await requireCurrentAdminAppCapability('canDeleteUsers');
          const result = await deleteAdminUser(data.userId);
          workflowLogger.info('Admin user deleted', {
            ...buildAdminUserWorkflowAttributes(OPERATIONS.ADMIN_USER_DELETE, {
              targetUserId: data.userId,
              result: 'success',
            }),
          });
          return result;
        } catch (error) {
          workflowLogger.error('Admin user delete failed', {
            ...buildAdminUserWorkflowAttributes(OPERATIONS.ADMIN_USER_DELETE, {
              targetUserId: data.userId,
              result: 'failure',
              failureCategory:
                error instanceof Error &&
                error.message === 'You cannot delete your own account.'
                  ? 'self_delete_blocked'
                  : 'mutation_failed',
            }),
          });
          throw error;
        }
      }
    );
  });
