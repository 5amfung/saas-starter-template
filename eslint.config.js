// @ts-check

import config from '@workspace/eslint-config/base';

export default [
  {
    ignores: [
      'apps/**',
      'packages/**',
      'node_modules/**',
      '.output/**',
      '.turbo/**',
      'eslint.config.js',
    ],
  },
  ...config,
];
