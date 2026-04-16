export const E2E_PASSWORD = 'Password123!';

export const E2E_PLATFORM_ADMIN = {
  userId: 'e2e_user_platform_admin',
  accountId: 'e2e_account_platform_admin',
  email: 'platform-admin@e2e.local',
  name: 'E2E Platform Admin',
  role: 'admin' as const,
};

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

export const E2E_ADMIN_ENTERPRISE_OWNER = {
  userId: 'e2e_user_enterprise_owner',
  accountId: 'e2e_account_enterprise_owner',
  organizationId: 'e2e_org_enterprise_owner',
  memberId: 'e2e_member_enterprise_owner',
  email: 'owner-enterprise@e2e.local',
  name: 'E2E Enterprise Owner',
  organizationName: 'E2E Enterprise Workspace',
  organizationSlug: 'e2e-enterprise-owner',
  role: 'owner' as const,
};

export const E2E_ADMIN_FILTER_USERS = {
  verified: {
    userId: 'e2e_user_verified_filter',
    accountId: 'e2e_account_verified_filter',
    email: 'verified-filter@e2e.local',
    name: 'E2E Verified Filter User',
    role: 'user' as const,
    emailVerified: true,
    banned: false,
  },
  unverified: {
    userId: 'e2e_user_unverified_filter',
    accountId: 'e2e_account_unverified_filter',
    email: 'unverified-filter@e2e.local',
    name: 'E2E Unverified Filter User',
    role: 'user' as const,
    emailVerified: false,
    banned: false,
  },
  banned: {
    userId: 'e2e_user_banned_filter',
    accountId: 'e2e_account_banned_filter',
    email: 'banned-filter@e2e.local',
    name: 'E2E Banned Filter User',
    role: 'user' as const,
    emailVerified: true,
    banned: true,
    banReason: 'E2E banned fixture',
  },
};

export const E2E_ADMIN_MUTATION_FIXTURES = {
  editableUser: {
    userId: 'e2e_user_admin_editable',
    accountId: 'e2e_account_admin_editable',
    email: 'admin-editable@e2e.local',
    name: 'E2E Editable User',
    role: 'user' as const,
    emailVerified: true,
    banned: false,
  },
  dangerousActionUser: {
    userId: 'e2e_user_admin_danger',
    accountId: 'e2e_account_admin_danger',
    email: 'admin-danger@e2e.local',
    name: 'E2E Danger User',
    role: 'user' as const,
    emailVerified: true,
    banned: false,
  },
  enterpriseWorkspace: {
    organizationId: 'e2e_org_admin_mutation_enterprise',
    name: 'E2E Mutation Enterprise Workspace',
    slug: 'e2e-mutation-enterprise',
    ownerUserId: 'e2e_user_admin_mutation_enterprise_owner',
    ownerAccountId: 'e2e_account_admin_mutation_enterprise_owner',
    ownerMemberId: 'e2e_member_admin_mutation_enterprise_owner',
    ownerEmail: 'owner-mutation-enterprise@e2e.local',
    ownerName: 'E2E Mutation Enterprise Owner',
    planId: 'enterprise' as const,
    role: 'owner' as const,
  },
};

export const E2E_ADMIN_WORKSPACES = {
  owner: {
    organizationId: E2E_BASELINE_USERS.owner.organizationId,
    name: E2E_BASELINE_USERS.owner.organizationName,
    slug: E2E_BASELINE_USERS.owner.organizationSlug,
    ownerEmail: E2E_BASELINE_USERS.owner.email,
    planId: 'free' as const,
  },
  proOwner: {
    organizationId: E2E_BASELINE_USERS.proOwner.organizationId,
    name: E2E_BASELINE_USERS.proOwner.organizationName,
    slug: E2E_BASELINE_USERS.proOwner.organizationSlug,
    ownerEmail: E2E_BASELINE_USERS.proOwner.email,
    planId: 'pro' as const,
  },
  enterprise: {
    organizationId: E2E_ADMIN_ENTERPRISE_OWNER.organizationId,
    name: E2E_ADMIN_ENTERPRISE_OWNER.organizationName,
    slug: E2E_ADMIN_ENTERPRISE_OWNER.organizationSlug,
    ownerEmail: E2E_ADMIN_ENTERPRISE_OWNER.email,
    planId: 'enterprise' as const,
  },
};
