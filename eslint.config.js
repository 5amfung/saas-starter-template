//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';
import pluginRouter from '@tanstack/eslint-plugin-router';

export default [
  { ignores: ['eslint.config.js', 'prettier.config.js'] },
  ...tanstackConfig,
  ...pluginRouter.configs['flat/recommended'],
];
