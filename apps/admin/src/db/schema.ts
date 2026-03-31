/**
 * Admin database schema.
 *
 * This file is the output target for Better Auth CLI schema generation:
 *   pnpm gen-auth-schema
 *
 * All tables use the `admin_` prefix to coexist with the main web app tables
 * in the shared Neon PostgreSQL database.
 */
export * from '../auth/admin-auth.schema';
