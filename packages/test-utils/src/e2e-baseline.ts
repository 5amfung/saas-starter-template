import { signInSeededUser } from './e2e-auth';
import { E2E_BASELINE_USERS, E2E_PASSWORD } from '@/db/seed/e2e-fixtures';

export type E2EBaselineUserKey = keyof typeof E2E_BASELINE_USERS;

export async function signInBaselineUser(
  baseUrl: string,
  key: E2EBaselineUserKey
) {
  const user = E2E_BASELINE_USERS[key];

  return signInSeededUser(baseUrl, {
    email: user.email,
    password: E2E_PASSWORD,
  });
}
