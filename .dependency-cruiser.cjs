/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-app-imports-billing-infrastructure',
      comment:
        'Applications must only use @workspace/billing public APIs, never internals.',
      severity: 'error',
      from: { path: '^apps/(web|admin)/src' },
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
      to: { path: '^apps/(web|admin)/src/' },
    },
    {
      name: 'no-new-app-db-schema-imports',
      comment:
        'Temporary allow-list for existing db-schema imports. Any new import from app code fails.',
      severity: 'error',
      from: {
        path: '^apps/(web|admin)/src',
        pathNot:
          '^apps/(web/src/init\\.ts|web/src/account/notification-preferences\\.server\\.ts|web/src/admin/admin\\.server\\.ts|admin/src/init\\.ts|admin/src/admin/admin\\.server\\.ts)$',
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
      name: 'no-routes-or-components-import-policy-server-admin',
      comment:
        'Admin components should consume policy functions/hooks, not server-only policy modules.',
      severity: 'error',
      from: { path: '^apps/admin/src/components/' },
      to: { path: '^apps/admin/src/policy/.*\\.server\\.ts$' },
    },
    {
      name: 'no-app-imports-policy-internals',
      comment:
        'Applications may depend on @workspace/policy through its public entry only.',
      severity: 'error',
      from: { path: '^apps/(web|admin)/src/' },
      to: { path: '^packages/policy/src/(?!index\\.ts$)' },
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
