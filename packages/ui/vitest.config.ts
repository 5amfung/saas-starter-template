import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
