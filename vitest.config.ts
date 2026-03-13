import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
      ['src/hooks/**/*.test.ts', 'jsdom'],
    ],
  },
});
