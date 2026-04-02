// @ts-check

import config from '@workspace/eslint-config/base';

export default [
  {
    ignores: ['eslint.config.js', 'dist/**'],
  },
  ...config,
];
