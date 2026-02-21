import { createAuthClient } from 'better-auth/react';
import {
  adminClient,
  inferOrgAdditionalFields,
  lastLoginMethodClient,
  organizationClient,
} from 'better-auth/client/plugins';
import type { auth } from '@/auth/auth.server';

export const authClient = createAuthClient({
  plugins: [
    lastLoginMethodClient(),
    adminClient(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
  ],
});
