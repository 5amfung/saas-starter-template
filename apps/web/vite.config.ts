import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

const config = defineConfig({
  server: {
    watch: {
      // Prevent chokidar from following pnpm symlinks into the global store
      // (81k+ files), which exhausts the OS file-descriptor limit (EMFILE).
      followSymlinks: false,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  plugins: [
    devtools(),
    nitro({
      // Inline E2E_MOCK_EMAIL at build time so Rollup can tree-shake the mock
      // email client and related test code from production builds. Only the
      // `build:e2e` script sets this env var; regular `build` leaves it unset.
      replace: {
        'process.env.E2E_MOCK_EMAIL': JSON.stringify(
          process.env.E2E_MOCK_EMAIL ?? ''
        ),
      },
      watchOptions: {
        followSymlinks: false,
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      router: {
        semicolons: true,
      },
    }),
    viteReact(),
  ],
});

export default config;
