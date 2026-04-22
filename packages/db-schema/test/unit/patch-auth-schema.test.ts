import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('patch-auth-schema script', () => {
  it('appends new indexes without creating an empty array element', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'patch-auth-schema-'));
    const schemaPath = join(tmpDir, 'auth.schema.ts');
    const scriptPath = fileURLToPath(
      new URL('../../scripts/patch-auth-schema.ts', import.meta.url)
    );

    writeFileSync(
      schemaPath,
      `import { pgTable, text, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const apikey = pgTable(
  'apikey',
  {
    id: text('id').primaryKey(),
    configId: text('config_id').notNull(),
    referenceId: text('reference_id'),
    key: text('key').notNull(),
    enabled: boolean('enabled').default(true),
    rateLimitTimeWindow: integer('rate_limit_time_window').default(300000),
    rateLimitMax: integer('rate_limit_max').default(5000),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('apikey_configId_idx').on(table.configId),
    index('apikey_referenceId_idx').on(table.referenceId),
    index('apikey_key_idx').on(table.key),
  ]
);
`,
      'utf8'
    );

    try {
      execFileSync(
        process.execPath,
        ['--experimental-strip-types', scriptPath, schemaPath],
        {
          cwd: fileURLToPath(new URL('../../..', import.meta.url)),
        }
      );

      const output = readFileSync(schemaPath, 'utf8');

      expect(output).toContain(
        'index("apikey_lookup_idx").on(table.configId, table.referenceId, table.enabled)'
      );
      expect(output).not.toMatch(/\n\s*,\n\s*index\(/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
