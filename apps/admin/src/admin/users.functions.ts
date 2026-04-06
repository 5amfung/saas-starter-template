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
import { requireCurrentAdminAppCapability } from '@/policy/admin-app-capabilities.server';

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
    return updateAdminUser(data);
  });

export const deleteUser = createServerFn()
  .inputValidator(adminDeleteUserSchema)
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canDeleteUsers');
    return deleteAdminUser(data.userId);
  });
