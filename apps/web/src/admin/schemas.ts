import * as z from "zod"

export const adminUserFormSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required." }),
  email: z.email({ error: "Please enter a valid email address." }),
  emailVerified: z.boolean(),
  image: z.string(),
  role: z.string().min(1, { error: "Role is required." }),
  banned: z.boolean(),
  banReason: z.string(),
  banExpires: z.string(),
})
