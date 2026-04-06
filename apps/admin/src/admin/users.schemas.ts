import * as z from 'zod';
import { adminUserFormSchema } from './schemas';

export const adminListUsersSchema = z.object({
  limit: z.number().int().min(1).max(100),
  offset: z.number().int().min(0),
  searchValue: z.string().optional(),
  searchOperator: z.enum(['contains']).optional(),
  filterField: z.enum(['id', 'emailVerified', 'banned']).optional(),
  filterValue: z.string().optional(),
  filterOperator: z.enum(['eq']).optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

export const adminGetUserSchema = z.object({
  userId: z.string(),
});

export const adminUpdateUserSchema = adminUserFormSchema.extend({
  userId: z.string(),
});

export const adminDeleteUserSchema = z.object({
  userId: z.string(),
});

export type AdminListUsersInput = z.infer<typeof adminListUsersSchema>;
export type AdminGetUserInput = z.infer<typeof adminGetUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminDeleteUserInput = z.infer<typeof adminDeleteUserSchema>;
