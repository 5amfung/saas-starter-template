import { createAuthClient } from "better-auth/react"
import {
  adminClient,
  inferAdditionalFields,
  inferOrgAdditionalFields,
  lastLoginMethodClient,
  organizationClient,
} from "better-auth/client/plugins"
import { stripeClient } from "@better-auth/stripe/client"
import type { createAuth } from "./auth.server"

// Use the return type of createAuth to infer additional fields.
type AuthInstance = ReturnType<typeof createAuth>

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<AuthInstance>(),
    lastLoginMethodClient(),
    adminClient(),
    organizationClient({
      schema: inferOrgAdditionalFields<AuthInstance>(),
    }),
    stripeClient({
      subscription: true,
    }),
  ],
})
