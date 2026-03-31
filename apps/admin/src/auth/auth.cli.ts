/**
 * CLI-only shim for @better-auth/cli schema generation.
 *
 * The CLI expects a named `auth` export that is a `betterAuth()` instance.
 * This file instantiates it with dummy values so the CLI can introspect the
 * plugin/schema configuration without connecting to a real database.
 *
 * Usage:
 *   pnpx @better-auth/cli generate --config ./src/auth/auth.cli.ts --output ./src/db/schema.ts --yes
 */
import { createAdminAuth } from './admin-auth.server';

// Dummy database — the CLI never actually connects.
const DUMMY_DB = {} as Parameters<typeof createAdminAuth>[0]['db'];

const DUMMY_EMAIL_CLIENT = {
  sendEmail: () => Promise.resolve({ id: '' }),
  config: { apiKey: '', fromEmail: '', appName: '' },
} as unknown as Parameters<typeof createAdminAuth>[0]['emailClient'];

export const auth = createAdminAuth({
  db: DUMMY_DB,
  emailClient: DUMMY_EMAIL_CLIENT,
  baseUrl: 'http://localhost:3001',
  secret: 'cli-dummy-secret',
  google: {
    clientId: 'dummy',
    clientSecret: 'dummy',
  },
});
