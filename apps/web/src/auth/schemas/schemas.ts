import * as z from 'zod';

// Validates a redirect URL is a safe relative path to prevent open redirect attacks.
export const safeRedirectSchema = z
  .string()
  .min(1)
  .refine(
    (val) => val.startsWith('/') && !val.startsWith('//') && !val.includes('\\')
  )
  .optional();

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

export const verifySearchSchema = z.object({
  email: z.email({ error: 'Invalid email.' }).optional(),
  redirect: safeRedirectSchema,
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

export const signinSearchSchema = z.object({
  error: z.string().optional(),
  redirect: safeRedirectSchema,
});

export const signupSearchSchema = z.object({
  redirect: safeRedirectSchema,
});

export const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});
