//  @ts-check

import config from '@workspace/eslint-config/react';

const webEntryRouteFiles = [
  'src/routes/index.tsx',
  'src/routes/_auth.tsx',
  'src/routes/_protected.tsx',
  'src/routes/accept-invite.tsx',
];

const browserFacingSourceFiles = [
  'src/components/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
  'src/routes/**/*.{ts,tsx}',
  'src/auth/client/**/*.{ts,tsx}',
  'src/router.tsx',
];

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
      '@workspace/no-top-level-app-service-getters': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/billing/core/infrastructure/*',
                '@/billing/core/internal/*',
              ],
              message:
                'Import from @/billing/core public API only (package root exports).',
            },
          ],
        },
      ],
    },
  },
  {
    files: browserFacingSourceFiles,
    ignores: ['src/**/*.server.{ts,tsx}', 'src/routes/api/**/*.{ts,tsx}'],
    rules: {
      '@workspace/no-browser-process-env': 'error',
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
  {
    files: webEntryRouteFiles,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='useSession'][callee.object.name='authClient']",
          message:
            'Do not derive web app entry from authClient.useSession() in entry routes; use web app entry hooks/helpers instead.',
        },
        {
          selector: "MemberExpression[property.name='emailVerified']",
          message:
            'Do not derive web app entry from raw session emailVerified fields in entry routes; use web app entry helpers instead.',
        },
        {
          selector: "MemberExpression[property.name='activeOrganizationId']",
          message:
            'Do not derive web app entry from raw workspace session state in entry routes; use web app entry helpers instead.',
        },
      ],
    },
  },
  ...config,
];
