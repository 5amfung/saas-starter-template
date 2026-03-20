// @ts-check

import pluginRouter from '@tanstack/eslint-plugin-router';
import baseConfig from './base.js';

/** ESLint config for React apps and packages (extends base + Router plugin). */
export default [...baseConfig, ...pluginRouter.configs['flat/recommended']];
