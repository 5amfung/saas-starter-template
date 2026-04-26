import test from 'node:test';
import { RuleTester } from 'eslint';
import rule from '../rules/no-browser-process-env.js';

RuleTester.describe = (name, fn) => test(name, fn);
RuleTester.it = (name, fn) => test(name, fn);
RuleTester.itOnly = (name, fn) => test.only(name, fn);

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

test('no-browser-process-env rule', () => {
  ruleTester.run('@workspace/no-browser-process-env', rule, {
    valid: [
      {
        code: `
          const dsn = import.meta.env.VITE_SENTRY_DSN;
        `,
      },
      {
        code: `
          export function Widget() {
            return null;
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          const secret = process.env.BETTER_AUTH_SECRET;
        `,
        errors: [
          {
            messageId: 'noProcessEnv',
          },
        ],
      },
      {
        code: `
          import { getAuth } from '@/init.server';
        `,
        errors: [
          {
            messageId: 'noServerInitImport',
          },
        ],
      },
      {
        code: `
          const init = await import('@/init.server');
        `,
        errors: [
          {
            messageId: 'noServerInitImport',
          },
        ],
      },
    ],
  });
});
