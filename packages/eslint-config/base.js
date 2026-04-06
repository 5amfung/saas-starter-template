// @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';
import noTopLevelAppServiceGetters from './rules/no-top-level-app-service-getters.js';

const workspacePlugin = {
  meta: {
    name: '@workspace/eslint-config',
  },
  rules: {
    'no-top-level-app-service-getters': noTopLevelAppServiceGetters,
  },
};

export default [
  ...tanstackConfig,
  {
    plugins: {
      '@workspace': workspacePlugin,
    },
  },
];
