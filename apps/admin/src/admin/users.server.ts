import { getRequestHeaders } from '@tanstack/react-start/server';
import { notFound } from '@tanstack/react-router';
import type {
  AdminListUsersInput,
  AdminUpdateUserInput,
} from './users.schemas';
import { getVerifiedAdminSession } from '@/auth/validators';
import { getAuth } from '@/init';

interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastSignInAt?: Date | string | null;
}

interface AdminListUsersResult {
  users: Array<AdminUserRecord>;
  total: number;
}

type AdminAuthApi = ReturnType<typeof getAuth>['api'];
type AdminApi = Pick<
  AdminAuthApi,
  'getUser' | 'listUsers' | 'adminUpdateUser' | 'removeUser'
>;

function getAdminApi(): AdminApi {
  return getAuth().api;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function unwrapBetterAuthResult<T>(result: unknown): T {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    result.error
  ) {
    throw new Error(getErrorMessage(result.error, 'Admin operation failed.'));
  }

  if (result && typeof result === 'object' && 'data' in result) {
    return result.data as T;
  }

  return result as T;
}

export async function listAdminUsers(input: AdminListUsersInput) {
  const headers = getRequestHeaders();
  const api = getAdminApi();
  const result = await api.listUsers({
    headers,
    query: input,
  });

  return unwrapBetterAuthResult<AdminListUsersResult>(result);
}

export async function getAdminUserDetail(userId: string) {
  const headers = getRequestHeaders();
  const api = getAdminApi();
  const result = await api.getUser({
    headers,
    query: { id: userId },
  });
  const user = unwrapBetterAuthResult<AdminUserRecord | null>(result);

  if (!user) {
    throw notFound();
  }

  return user;
}

export async function updateAdminUser(input: AdminUpdateUserInput) {
  const headers = getRequestHeaders();
  const api = getAdminApi();
  const result = await api.adminUpdateUser({
    headers,
    body: {
      userId: input.userId,
      data: {
        name: input.name,
        email: input.email,
        emailVerified: input.emailVerified,
        image: input.image || null,
        role: input.role || null,
        banned: input.banned,
        banReason: input.banReason || null,
        banExpires: input.banExpires ? new Date(input.banExpires) : null,
      },
    },
  });

  unwrapBetterAuthResult(result);
  return { success: true as const };
}

export async function deleteAdminUser(userId: string) {
  const headers = getRequestHeaders();
  const session = await getVerifiedAdminSession(headers, getAuth());
  const api = getAdminApi();

  if (session.user.id === userId) {
    throw new Error('You cannot delete your own account.');
  }

  const result = await api.removeUser({
    headers,
    body: { userId },
  });

  unwrapBetterAuthResult(result);
  return { success: true as const };
}
