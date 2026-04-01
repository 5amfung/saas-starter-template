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
  ...config,
];
