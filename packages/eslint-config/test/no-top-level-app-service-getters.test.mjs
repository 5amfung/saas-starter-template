import test from 'node:test';
import { RuleTester } from 'eslint';
import rule from '../rules/no-top-level-app-service-getters.js';

RuleTester.describe = (name, fn) => test(name, fn);
RuleTester.it = (name, fn) => test(name, fn);
RuleTester.itOnly = (name, fn) => test.only(name, fn);

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

test('no-top-level-app-service-getters rule', () => {
  ruleTester.run('@workspace/no-top-level-app-service-getters', rule, {
    valid: [
      {
        code: `
          import { getAuth } from '@/init';

          export async function handler() {
            return getAuth();
          }
        `,
      },
      {
        code: `
          import * as init from '@/init';

          class Example {
            service = init.getDb();
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          import { getAuth } from '@/init';

          const auth = getAuth();
        `,
        errors: [
          {
            messageId: 'noTopLevelGetter',
          },
        ],
      },
      {
        code: `
          import * as init from '@/init';

          const { getDb } = init;
          getDb();
        `,
        errors: [
          {
            messageId: 'noTopLevelGetter',
          },
        ],
      },
      {
        code: `
          import * as init from '@/init';

          export const { getEmailClient = fallback } = init;
          getEmailClient();
        `,
        errors: [
          {
            messageId: 'noTopLevelGetter',
          },
        ],
      },
      {
        code: `
          import { getDb } from '@/init';

          class Example {
            static {
              getDb();
            }
          }
        `,
        errors: [
          {
            messageId: 'noTopLevelGetter',
          },
        ],
      },
      {
        code: `
          import { getAuth } from '@/init';

          const auth = (() => getAuth())();
        `,
        errors: [
          {
            messageId: 'noTopLevelGetter',
          },
        ],
      },
    ],
  });
});
