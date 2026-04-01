import * as z from 'zod';

export const accountProfileSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required.' }),
});

export const changeEmailSchema = z.object({
  newEmail: z.email({ error: 'Please enter a valid email address.' }),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: 'Current password is required.' }),
    newPassword: z
      .string()
      .min(8, { error: 'Password must be at least 8 characters.' }),
    confirmPassword: z
      .string()
      .min(1, { error: 'Please confirm your password.' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
