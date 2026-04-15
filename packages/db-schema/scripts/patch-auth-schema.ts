/**
 * Patches an auth.schema.ts file after Better Auth CLI generate.
 * Injects recommended indexes into generated Drizzle tables so they are not lost on regenerate.
 *
 * Usage: tsx scripts/patch-auth-schema.ts <path/to/auth.schema.ts>
 *
 * Based on: https://github.com/better-auth/better-auth/discussions/5717
 * Run automatically after gen-auth-schema (see package.json).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (!process.argv[2]) {
  console.error(
    'Usage: tsx scripts/patch-auth-schema.ts <path/to/auth.schema.ts>'
  );
  process.exit(1);
}

const authSchemaPath = resolve(process.argv[2]);

const EXPORT_PREFIX = 'export const ';

/** Recommended indexes per table. CLI generates some tables with indexes; we add any missing. */
const TABLE_INDEXES: Record<string, Array<string>> = {
  user: [
    'index("user_createdAt_idx").on(table.createdAt)',
    'index("user_emailVerified_idx").on(table.emailVerified)',
    'index("user_banned_idx").on(table.banned)',
    'index("user_lastSignInAt_idx").on(table.lastSignInAt)',
  ],
  session: ['index("session_token_idx").on(table.token)'],
  apikey: [
    'index("apikey_lookup_idx").on(table.configId, table.referenceId, table.enabled)',
  ],
  subscription: [
    'index("subscription_referenceId_idx").on(table.referenceId)',
    'index("subscription_stripeCustomerId_idx").on(table.stripeCustomerId)',
    'index("subscription_stripeSubscriptionId_idx").on(table.stripeSubscriptionId)',
  ],
};

const PG_CORE_IMPORT_REGEX =
  /import\s*\{([^}]+)\}\s*from\s*["']drizzle-orm\/pg-core["']/;

function findMatchingDelimiter(
  str: string,
  startPos: number,
  openChar: string,
  closeChar: string
): number {
  let depth = 0;
  for (let i = startPos; i < str.length; i += 1) {
    if (str[i] === openChar) depth += 1;
    if (str[i] === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Extract index id from a line like index("session_token_idx").on(...) or index('session_token_idx').on(...). */
function indexIdFromLine(line: string): string | null {
  const m = line.match(/index\s*\(\s*["']([^"']+)["']\s*\)/);
  return m ? m[1] : null;
}

function main(): void {
  let content = readFileSync(authSchemaPath, 'utf-8');

  // Ensure `index` is in the pg-core import if we use it and it's missing.
  const match = content.match(PG_CORE_IMPORT_REGEX);
  if (match && !match[1].includes('index')) {
    content = content.replace(PG_CORE_IMPORT_REGEX, (full) =>
      full.replace(match[1], match[1].replace(/(\s*)(\})/, '$1index,$2'))
    );
  }

  for (const [varName, indexLines] of Object.entries(TABLE_INDEXES)) {
    const exportPattern = `${EXPORT_PREFIX}${varName} = pgTable(`;
    const exportIndex = content.indexOf(exportPattern);
    if (exportIndex === -1) continue;

    const columnsStart = content.indexOf('{', exportIndex);
    if (columnsStart === -1) continue;

    const columnsEnd = findMatchingDelimiter(content, columnsStart, '{', '}');
    if (columnsEnd === -1) continue;

    const closingParen = content.indexOf(');', columnsEnd);
    if (closingParen === -1) continue;

    const tableSlice = content.slice(exportIndex, closingParen + 2);

    if (tableSlice.includes('(table) => [')) {
      // Table already has indexes; add any of ours that are missing.
      const arrayStart =
        content.indexOf('(table) => [', exportIndex) + '(table) => ['.length;
      const arrayEnd = findMatchingDelimiter(content, arrayStart - 1, '[', ']');
      if (arrayEnd === -1) continue;
      const existingBlock = content.slice(exportIndex, arrayEnd + 1);
      const existingIds = new Set(
        existingBlock
          .split('\n')
          .map(indexIdFromLine)
          .filter((id): id is string => id != null)
      );
      const toAdd = indexLines.filter((line) => {
        const id = indexIdFromLine(line);
        return id != null && !existingIds.has(id);
      });
      if (toAdd.length === 0) continue;
      const insertion =
        ',' + toAdd.map((line) => `\n    ${line}`).join(',') + ',\n';
      content =
        content.slice(0, arrayEnd) + insertion + content.slice(arrayEnd);
      continue;
    }

    const indexesBlock = `, (table) => [\n    ${indexLines.join(',\n    ')},\n  ]\n`;
    content =
      content.slice(0, columnsEnd + 1) +
      indexesBlock +
      content.slice(closingParen);
  }

  writeFileSync(authSchemaPath, content);
}

main();
