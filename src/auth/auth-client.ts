import { createAuthClient } from 'better-auth/react';
import {
  adminClient,
  lastLoginMethodClient,
  organizationClient,
} from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [lastLoginMethodClient(), adminClient(), organizationClient()],
});
