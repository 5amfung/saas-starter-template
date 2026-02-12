import * as z from 'zod';

export const loginSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address.' }),
  password: z.string().min(1, { error: 'Password is required.' }),
});

export const signupSchema = z
  .object({
    email: z.email({ error: 'Please enter a valid email address.' }),
    password: z
      .string()
      .min(8, { error: 'Password must be at least 8 characters.' }),
    confirmPassword: z
      .string()
      .min(1, { error: 'Please confirm your password.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const verifySchema = z.object({
  otp: z.string().length(6, { error: 'Please enter the 6-digit code.' }),
});

export const verifySearchSchema = z.object({
  email: z.email({ error: 'Invalid email.' }),
});

export const forgotPasswordSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address.' }),
});

export const resetPasswordSchema = z
  .object({
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

export const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});
