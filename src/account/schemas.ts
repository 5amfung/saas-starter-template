import * as z from 'zod';

export const accountProfileSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required.' }),
});

export const changeEmailSchema = z.object({
  newEmail: z.email({ error: 'Please enter a valid email address.' }),
});
