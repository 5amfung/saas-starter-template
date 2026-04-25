/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-app-imports-billing-infrastructure',
      comment:
        'UI and route code must use billing core exports or app server wrappers, never infrastructure internals.',
      severity: 'error',
      from: {
        path: '^apps/web/src/(components|routes|hooks|admin|workspace)/',
      },
      to: { path: '^apps/web/src/billing/core/infrastructure/' },
    },
    {
      name: 'no-billing-core-imports-db-schema',
      comment:
        'Billing storage access must stay in infrastructure adapters, not contracts/domain/application.',
      severity: 'error',
      from: {
        path: '^apps/web/src/billing/core/(contracts|domain|application)/',
      },
      to: { path: '^apps/web/src/db/schema/' },
    },
    {
      name: 'no-billing-dependency-on-apps',
      comment: 'Domain packages cannot depend on application layers.',
      severity: 'error',
      from: { path: '^apps/web/src/billing/core/' },
      to: {
        path: '^apps/web/src/(routes|components|admin|workspace|auth|policy|email|observability)/',
      },
    },
    {
      name: 'no-ui-imports-db',
      comment:
        'UI and client-safe code must use server functions, not database client or schema modules.',
      severity: 'error',
      from: {
        path: '^apps/web/src/(components|routes|hooks|auth/client)/',
      },
      to: { path: '^apps/web/src/db/' },
    },
    {
      name: 'no-db-imports-ui-runtime',
      comment:
        'The database layer must stay below route, component, and hook code.',
      severity: 'error',
      from: { path: '^apps/web/src/db/' },
      to: { path: '^apps/web/src/(routes|components|hooks)/' },
    },
    {
      name: 'no-routes-or-components-import-policy-server-web',
      comment:
        'Web components should consume policy functions/hooks, not server-only policy modules.',
      severity: 'error',
      from: { path: '^apps/web/src/components/' },
      to: { path: '^apps/web/src/policy/.*\\.server\\.ts$' },
    },
    {
      name: 'no-policy-core-imports-runtime',
      comment:
        'Pure policy evaluators must stay independent of app runtime, persistence, and UI layers.',
      severity: 'error',
      from: { path: '^apps/web/src/policy/core/' },
      to: {
        path: '^apps/web/src/(routes|components|db|auth/server|observability|email)/',
      },
    },
    {
      name: 'no-ui-imports-integration-repository',
      comment:
        'UI should use integration server functions and route-safe types, not repository internals.',
      severity: 'error',
      from: { path: '^apps/web/src/(components|routes|hooks)/' },
      to: { path: '^apps/web/src/integrations/core/repository\\.ts$' },
    },
    {
      name: 'no-ui-imports-integration-server',
      comment: 'UI should not import integration server-only modules directly.',
      severity: 'error',
      from: { path: '^apps/web/src/(components|routes|hooks)/' },
      to: { path: '^apps/web/src/integrations/.*\\.server\\.ts$' },
    },
    {
      name: 'no-auth-index-imports-server-values',
      comment:
        'The auth barrel is client-safe and must not re-export server runtime values.',
      severity: 'error',
      from: { path: '^apps/web/src/auth/index\\.ts$' },
      to: { path: '^apps/web/src/(db|email|observability/server\\.ts)' },
    },
    {
      name: 'no-ui-imports-server-observability',
      comment:
        'Browser-safe UI code can use observability/client, not server workflow logging.',
      severity: 'error',
      from: { path: '^apps/web/src/(components|routes|hooks|auth/client)/' },
      to: {
        path: '^apps/web/src/observability/(server|request-logger\\.server)\\.ts$',
      },
    },
    {
      name: 'no-ui-imports-email-server',
      comment:
        'UI and client-safe code must not import the Resend server adapter.',
      severity: 'error',
      from: { path: '^apps/web/src/(components|routes|hooks|auth/client)/' },
      to: { path: '^apps/web/src/email/resend\\.server\\.ts$' },
    },
  ],
  options: {
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
    doNotFollow: {
      path: '(^node_modules|\\.pnpm-store)',
    },
    exclude: {
      path: '(^node_modules|\\.turbo|dist|build|\\.output|test|__tests__)',
    },
  },
};
