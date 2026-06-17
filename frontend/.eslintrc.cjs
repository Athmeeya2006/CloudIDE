/* ESLint configuration for the Cloud IDE frontend.
 *
 * Uses the classic (eslintrc) format so it is picked up by the ESLint 8.x
 * pinned in devDependencies without extra flags. Rules favour catching real
 * bugs (rules-of-hooks, no-explicit-any) while keeping the dependency-array
 * linting advisory, since several editor effects intentionally run once. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    '*.config.ts',
    '*.config.js',
    '.eslintrc.cjs',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/ban-ts-comment': [
      'error',
      { 'ts-expect-error': 'allow-with-description' },
    ],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
