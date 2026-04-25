/**
 * CLI-only shim for @better-auth/cli schema generation.
 *
 * The CLI expects a named `auth` export (or default export) that is a
 * `betterAuth()` instance. Since our real auth uses a `createAuth()`
 * factory, this file instantiates it with dummy values so the CLI can
 * introspect the plugin/schema configuration.
 *
 * Usage: pnpm dlx @better-auth/cli generate --config apps/web/src/auth/server/auth.cli.ts ...
 */
import { createAuth } from './auth.server';

// Dummy in-memory database — the CLI never actually connects.
const DUMMY_DB = {} as Parameters<typeof createAuth>[0]['db'];

const DUMMY_EMAIL_CLIENT = {
  sendEmail: () => Promise.resolve({ id: '' }),
  config: { apiKey: '', fromEmail: '', appName: '' },
} as unknown as Parameters<typeof createAuth>[0]['emailClient'];

export const auth = createAuth({
  db: DUMMY_DB,
  emailClient: DUMMY_EMAIL_CLIENT,
  baseUrl: 'http://localhost:3000',
  secret: 'cli-dummy-secret',
  google: {
    clientId: 'dummy',
    clientSecret: 'dummy',
  },
  stripe: {
    secretKey: 'sk_test_dummy',
    webhookSecret: 'whsec_dummy',
  },
});
