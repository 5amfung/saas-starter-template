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

interface AdminApiLike {
  listUsers: (input: {
    headers: Headers;
    query: AdminListUsersInput;
  }) => Promise<unknown>;
  updateUser: (input: {
    headers: Headers;
    userId: string;
    data: {
      name: string;
      email: string;
      emailVerified: boolean;
      image: string | null;
      role: string | null;
      banned: boolean;
      banReason: string | null;
      banExpires: Date | null;
    };
  }) => Promise<unknown>;
  removeUser: (input: { headers: Headers; userId: string }) => Promise<unknown>;
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
  const api = getAuth().api as unknown as AdminApiLike;
  const result = await api.listUsers({
    headers,
    query: input,
  });

  return unwrapBetterAuthResult<AdminListUsersResult>(result);
}

export async function getAdminUserDetail(userId: string) {
  const data = await listAdminUsers({
    limit: 1,
    offset: 0,
    filterField: 'id',
    filterValue: userId,
    filterOperator: 'eq',
  });

  const user = data.users.at(0);
  if (!user) {
    throw notFound();
  }

  return user;
}

export async function updateAdminUser(input: AdminUpdateUserInput) {
  const headers = getRequestHeaders();
  const api = getAuth().api as unknown as AdminApiLike;
  const result = await api.updateUser({
    headers,
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
  });

  unwrapBetterAuthResult(result);
  return { success: true as const };
}

export async function deleteAdminUser(userId: string) {
  const headers = getRequestHeaders();
  const session = await getVerifiedAdminSession(headers, getAuth());
  const api = getAuth().api as unknown as AdminApiLike;

  if (session.user.id === userId) {
    throw new Error('You cannot delete your own account.');
  }

  const result = await api.removeUser({
    headers,
    userId,
  });

  unwrapBetterAuthResult(result);
  return { success: true as const };
}
