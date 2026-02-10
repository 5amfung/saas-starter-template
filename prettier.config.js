//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: ['^react', '<THIRD_PARTY_MODULES>', '^@/(.*)$', '^[./]'],
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
};

export default config;
