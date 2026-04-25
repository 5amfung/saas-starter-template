import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

export const ORGANIZATION_DEFAULT_ROLES = ['owner', 'admin', 'member'] as const;

export const organizationStatements = {
  ...defaultStatements,
  apiKey: ['create', 'read', 'update', 'delete'],
} as const;

export const organizationAccessControl = createAccessControl(
  organizationStatements
);

export const organizationRoles = {
  // Better Auth gives owners full access by default, but we still include the
  // role explicitly so the configured roles map remains complete and the app's
  // workspace role union continues to include `owner`.
  owner: organizationAccessControl.newRole({
    ...ownerAc.statements,
    apiKey: ['create', 'read', 'update', 'delete'],
  }),
  admin: organizationAccessControl.newRole({
    ...adminAc.statements,
    apiKey: ['create', 'read', 'update', 'delete'],
  }),
  member: organizationAccessControl.newRole({
    ...memberAc.statements,
    apiKey: ['read'],
  }),
} as const;

export type OrganizationDefaultRole =
  (typeof ORGANIZATION_DEFAULT_ROLES)[number];
