import { stripeClient } from '@better-auth/stripe/client';
import {
  adminClient,
  inferAdditionalFields,
  inferOrgAdditionalFields,
  lastLoginMethodClient,
  organizationClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { createAuth } from '../server/auth.server';

// Use the return type of createAuth to infer additional fields.
type AuthInstance = ReturnType<typeof createAuth>;

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
});
