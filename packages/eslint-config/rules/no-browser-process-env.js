// @ts-check

const SERVER_INIT_MODULE = '@/init.server';

/**
 * @param {import('estree').Node} node
 */
function isProcessEnvMember(node) {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'process' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'env'
  );
}

/**
 * @param {import('estree').Node} node
 */
function isServerInitDynamicImport(node) {
  if (node.type === 'ImportExpression') {
    return (
      node.source.type === 'Literal' && node.source.value === SERVER_INIT_MODULE
    );
  }

  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Import' &&
    node.arguments[0]?.type === 'Literal' &&
    node.arguments[0].value === SERVER_INIT_MODULE
  );
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow server env access and service initialization from browser-facing source files.',
    },
    schema: [],
    messages: {
      noProcessEnv:
        'Do not read process.env from browser-facing source. Use a server module/server function, or import.meta.env for intentionally public Vite env values.',
      noServerInitImport:
        'Server env/service initialization must stay behind server modules or createServerFn handlers, not browser-facing source.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== SERVER_INIT_MODULE) return;

        context.report({
          node,
          messageId: 'noServerInitImport',
        });
      },
      ImportExpression(node) {
        if (!isServerInitDynamicImport(node)) return;

        context.report({
          node,
          messageId: 'noServerInitImport',
        });
      },
      CallExpression(node) {
        if (!isServerInitDynamicImport(node)) return;

        context.report({
          node,
          messageId: 'noServerInitImport',
        });
      },
      MemberExpression(node) {
        if (!isProcessEnvMember(node)) return;

        context.report({
          node,
          messageId: 'noProcessEnv',
        });
      },
    };
  },
};

export default rule;
