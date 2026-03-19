// @ts-check

import config from '@workspace/eslint-config/base';

export default [
  {
    ignores: ['apps/**', 'packages/**', '.turbo/**', 'eslint.config.js'],
  },
  ...config,
];
