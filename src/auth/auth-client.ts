import { createAuthClient } from 'better-auth/react';
import {
  adminClient,
  inferAdditionalFields,
  inferOrgAdditionalFields,
  lastLoginMethodClient,
  organizationClient,
} from 'better-auth/client/plugins';
import type { auth } from '@/auth/auth.server';

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    lastLoginMethodClient(),
    adminClient(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
  ],
});
