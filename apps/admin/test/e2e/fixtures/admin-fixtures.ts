import {
  E2E_ADMIN_FILTER_USERS,
  E2E_ADMIN_WORKSPACES,
  E2E_BASELINE_USERS,
  E2E_PLATFORM_ADMIN,
} from '@workspace/db-schema';

export const adminFixtures = {
  platformAdmin: E2E_PLATFORM_ADMIN,
  users: {
    owner: E2E_BASELINE_USERS.owner,
    admin: E2E_BASELINE_USERS.admin,
    member: E2E_BASELINE_USERS.member,
    proOwner: E2E_BASELINE_USERS.proOwner,
    verified: E2E_ADMIN_FILTER_USERS.verified,
    unverified: E2E_ADMIN_FILTER_USERS.unverified,
    banned: E2E_ADMIN_FILTER_USERS.banned,
  },
  workspaces: E2E_ADMIN_WORKSPACES,
};
