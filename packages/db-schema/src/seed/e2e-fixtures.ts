export const E2E_PASSWORD = 'Password123!';

export const E2E_BASELINE_USERS = {
  owner: {
    userId: 'e2e_user_owner',
    accountId: 'e2e_account_owner',
    organizationId: 'e2e_org_owner',
    memberId: 'e2e_member_owner',
    email: 'owner@e2e.local',
    name: 'E2E Owner',
    organizationName: 'E2E Owner Workspace',
    organizationSlug: 'e2e-owner',
    role: 'owner' as const,
  },
  admin: {
    userId: 'e2e_user_admin',
    accountId: 'e2e_account_admin',
    organizationId: 'e2e_org_owner',
    memberId: 'e2e_member_admin',
    email: 'admin@e2e.local',
    name: 'E2E Admin',
    role: 'admin' as const,
  },
  member: {
    userId: 'e2e_user_member',
    accountId: 'e2e_account_member',
    organizationId: 'e2e_org_owner',
    memberId: 'e2e_member_member',
    email: 'member@e2e.local',
    name: 'E2E Member',
    role: 'member' as const,
  },
  proOwner: {
    userId: 'e2e_user_pro_owner',
    accountId: 'e2e_account_pro_owner',
    organizationId: 'e2e_org_pro_owner',
    memberId: 'e2e_member_pro_owner',
    email: 'owner-pro@e2e.local',
    name: 'E2E Pro Owner',
    organizationName: 'E2E Pro Workspace',
    organizationSlug: 'e2e-pro-owner',
    role: 'owner' as const,
  },
};
