import { createServerFn } from '@tanstack/react-start';
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
import { logger } from '@/lib/logger';
import { requireCurrentAdminAppCapability } from '@/policy/admin-app-capabilities.server';

const ADMIN_USER_UPDATE_OPERATION = 'admin.user.updated';
const ADMIN_USER_DELETE_OPERATION = 'admin.user.deleted';

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
    await requireCurrentAdminAppCapability('canManageUsers');
    logger('info', 'admin user update started', {
      operation: ADMIN_USER_UPDATE_OPERATION,
      userId: data.userId,
    });
    return updateAdminUser(data);
  });

export const deleteUser = createServerFn()
  .inputValidator(adminDeleteUserSchema)
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canDeleteUsers');
    logger('info', 'admin user delete started', {
      operation: ADMIN_USER_DELETE_OPERATION,
      userId: data.userId,
    });
    return deleteAdminUser(data.userId);
  });
