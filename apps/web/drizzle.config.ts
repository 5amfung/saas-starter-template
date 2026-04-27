import { defineConfig } from 'drizzle-kit';
import { loadEnv } from 'vite';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

if (!hasDatabaseUrl) {
  delete process.env.DATABASE_URL;
}

const localEnv =
  !process.env.CI && !hasDatabaseUrl
    ? loadEnv(
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
        process.cwd(),
        ''
      )
    : {};

export default defineConfig({
  schema: './src/db/schema/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || localEnv.DATABASE_URL,
  },
});
