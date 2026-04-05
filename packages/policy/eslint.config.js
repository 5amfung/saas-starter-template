// @ts-check

import config from '@workspace/eslint-config/base';

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'eslint.config.js'],
  },
  ...config,
];
