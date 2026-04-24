/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-app-imports-billing-infrastructure',
      comment:
        'Applications must only use @workspace/billing public APIs, never internals.',
      severity: 'error',
      from: { path: '^apps/web/src' },
      to: { path: '^packages/billing/src/(infrastructure|internal)/' },
    },
    {
      name: 'no-billing-core-imports-db-schema',
      comment:
        'Billing storage access must stay in infrastructure adapters, not contracts/domain/application.',
      severity: 'error',
      from: { path: '^packages/billing/src/(contracts|domain|application)/' },
      to: { path: '^packages/db-schema/src/' },
    },
    {
      name: 'no-billing-dependency-on-apps',
      comment: 'Domain packages cannot depend on application layers.',
      severity: 'error',
      from: { path: '^packages/billing/src/' },
      to: { path: '^apps/web/src/' },
    },
    {
      name: 'no-new-app-db-schema-imports',
      comment:
        'Temporary allow-list for existing db-schema imports. Any new import from app code fails.',
      severity: 'error',
      from: {
        path: '^apps/web/src',
        pathNot:
          '^apps/web/src/(init\\.ts|account/notification-preferences\\.server\\.ts|admin/admin\\.server\\.ts)$',
      },
      to: { path: '^packages/db-schema/src/' },
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
