//  @ts-check

import config from '@workspace/eslint-config/react';

export default [
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      '.output/**',
      'playwright-report/**',
      'test-results/**',
      'test/e2e/seed.spec.ts',
      'routeTree.gen.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@workspace/billing/infrastructure/*',
                '@workspace/billing/internal/*',
              ],
              message:
                'Import from @workspace/billing public API only (package root exports).',
            },
          ],
        },
      ],
    },
  },
  ...config,
];
