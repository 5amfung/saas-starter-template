// @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';
import importPlugin from 'eslint-plugin-import-x';

/** Base ESLint config for all packages (TypeScript + import ordering). */
export default [
  ...tanstackConfig,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'never',
        },
      ],
    },
  },
];
