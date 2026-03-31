import {
  adminClient,
  inferAdditionalFields,
  lastLoginMethodClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { createAdminAuth } from './admin-auth.server';

type AdminAuthInstance = ReturnType<typeof createAdminAuth>;

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<AdminAuthInstance>(),
    lastLoginMethodClient(),
    adminClient(),
  ],
});
