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
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/policy/*.server', '@/policy/**/*.server'],
              message:
                'Routes and components must consume app policy functions/hooks, not server-only policy modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "BinaryExpression[operator='==='][right.value='owner'][left.name='role']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='admin'][left.name='role']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='member'][left.name='role']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='owner'][left.name='workspaceRole']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='admin'][left.name='workspaceRole']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='member'][left.name='workspaceRole']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='owner'][left.name='currentUserRole']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='admin'][left.name='currentUserRole']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
        {
          selector:
            "BinaryExpression[operator='==='][right.value='member'][left.name='currentUserRole']",
          message:
            'Do not authorize from raw workspace roles in routes; consume capabilities instead.',
        },
      ],
    },
  },
  ...config,
];
