// @ts-check

const SERVICE_GETTERS = new Set(['getAuth', 'getDb', 'getEmailClient']);

/**
 * Returns true when the getter call is evaluated at module scope rather than
 * inside a runtime function boundary.
 *
 * @param {import('eslint').Rule.Node} node
 * @param {import('eslint').SourceCode} sourceCode
 */
function isModuleScopeGetterCall(node, sourceCode) {
  const ancestors = sourceCode.getAncestors(node);

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];

    switch (ancestor.type) {
      case 'FunctionDeclaration':
        return false;
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const parent = ancestors[index - 1];
        const isIife =
          parent?.type === 'CallExpression' && parent.callee === ancestor;

        if (!isIife) {
          return false;
        }
        break;
      }
      case 'PropertyDefinition':
        if (ancestor.static !== true) {
          return false;
        }
        break;
      default:
        break;
    }
  }

  return true;
}

/**
 * @param {import('eslint').SourceCode} sourceCode
 */
function collectTrackedImports(sourceCode) {
  /** @type {Set<string>} */
  const directImports = new Set();
  /** @type {Set<string>} */
  const namespaceImports = new Set();
  /** @type {import('estree').Program['body']} */
  const statements = sourceCode.ast.body;

  for (const statement of statements) {
    if (statement.type !== 'ImportDeclaration') continue;
    if (statement.source.value !== '@/init') continue;

    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        SERVICE_GETTERS.has(specifier.imported.name)
      ) {
        directImports.add(specifier.local.name);
      }

      if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaceImports.add(specifier.local.name);
      }
    }
  }

  for (const statement of statements) {
    const declaration =
      statement.type === 'VariableDeclaration'
        ? statement
        : statement.type === 'ExportNamedDeclaration' &&
            statement.declaration?.type === 'VariableDeclaration'
          ? statement.declaration
          : null;

    if (!declaration) continue;

    for (const declarator of declaration.declarations) {
      if (
        declarator.id.type !== 'ObjectPattern' ||
        declarator.init?.type !== 'Identifier' ||
        !namespaceImports.has(declarator.init.name)
      ) {
        continue;
      }

      for (const property of declarator.id.properties) {
        if (property.type !== 'Property' || property.computed) continue;
        if (property.key.type !== 'Identifier') continue;
        if (!SERVICE_GETTERS.has(property.key.name)) continue;

        if (property.value.type === 'Identifier') {
          directImports.add(property.value.name);
        }

        if (
          property.value.type === 'AssignmentPattern' &&
          property.value.left.type === 'Identifier'
        ) {
          directImports.add(property.value.left.name);
        }
      }
    }
  }

  return { directImports, namespaceImports };
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow top-level calls to app service getters that recreate import-time side effects.',
    },
    schema: [],
    messages: {
      noTopLevelGetter:
        'Do not call app service getters at module top level. Call them inside executed functions only.',
    },
  },
  create(context) {
    const { sourceCode } = context;
    const { directImports, namespaceImports } =
      collectTrackedImports(sourceCode);

    return {
      CallExpression(node) {
        const isDirectGetterCall =
          node.callee.type === 'Identifier' &&
          directImports.has(node.callee.name);

        const isNamespaceGetterCall =
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.object.type === 'Identifier' &&
          namespaceImports.has(node.callee.object.name) &&
          node.callee.property.type === 'Identifier' &&
          SERVICE_GETTERS.has(node.callee.property.name);

        if (!isDirectGetterCall && !isNamespaceGetterCall) return;
        if (!isModuleScopeGetterCall(node, sourceCode)) return;

        context.report({
          node,
          messageId: 'noTopLevelGetter',
        });
      },
    };
  },
};

export default rule;
