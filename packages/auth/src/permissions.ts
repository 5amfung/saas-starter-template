/**
 * RBAC scaffold for future organization permission customization.
 *
 * Current implementation uses Better Auth organization defaults:
 * - roles: owner, admin, member
 * - resources: organization, member, invitation
 *
 * This file intentionally stays lightweight so future custom resources/roles
 * can be added without touching feature code.
 *
 * Example: add a custom resource statement.
 * -----------------------------------------
 * import { createAccessControl } from 'better-auth/plugins/access';
 * import { defaultStatements } from 'better-auth/plugins/organization/access';
 *
 * const statement = {
 *   ...defaultStatements,
 *   project: ['create', 'read', 'update', 'delete'],
 * } as const;
 *
 * const ac = createAccessControl(statement);
 *
 * Example: extend default roles with new resource permissions.
 * ------------------------------------------------------------
 * import { adminAc, memberAc, ownerAc } from 'better-auth/plugins/organization/access';
 *
 * export const member = ac.newRole({
 *   ...memberAc.statements,
 *   project: ['read'],
 * });
 *
 * export const admin = ac.newRole({
 *   ...adminAc.statements,
 *   project: ['create', 'read', 'update', 'delete'],
 * });
 *
 * export const owner = ac.newRole({
 *   ...ownerAc.statements,
 *   project: ['create', 'read', 'update', 'delete'],
 * });
 *
 * Example: wire into Better Auth plugins later.
 * ---------------------------------------------
 * // auth.server.ts
 * organization({
 *   ac,
 *   roles: { owner, admin, member },
 * })
 *
 * // auth-client.ts
 * organizationClient({
 *   ac,
 *   roles: { owner, admin, member },
 * })
 */
export const ORGANIZATION_DEFAULT_ROLES = ['owner', 'admin', 'member'] as const;

export type OrganizationDefaultRole =
  (typeof ORGANIZATION_DEFAULT_ROLES)[number];
