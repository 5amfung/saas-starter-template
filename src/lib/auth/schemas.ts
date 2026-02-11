import * as z from 'zod';

export const loginSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address.' }),
  password: z.string().min(1, { error: 'Password is required.' }),
});
