import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Full standard global sets. The previous hand-rolled list omitted
      // standard web-platform globals (AbortSignal, Response, ReadableStream,
      // Blob, ResizeObserver, requestAnimationFrame, …) which produced ~36
      // bogus `no-undef` errors on valid code. `browser` covers the DOM,
      // `node`/`nodeBuiltin` cover the API server, `es2022` covers builtins.
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        // TS-ecosystem / injected globals not present in the standard sets.
        React: 'readonly',      // referenced as a type namespace (React.FormEvent)
        NodeJS: 'readonly',     // TS namespace from @types/node
        gtag: 'readonly',       // injected by the Google Analytics script tag
        // Fetch API *type-only* globals — DOM lib types used as type
        // annotations; only flagged because parsing is JS-mode.
        RequestInit: 'readonly',
        RequestInfo: 'readonly',
        FormData: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@typescript-eslint': typescript,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'no-useless-escape': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['api/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-console': 'off',
      // Match the base config: `any` is a lint-visible warning, not a hard
      // error. The ~90 existing `any`s are mostly intentional (catch-clause
      // error handling, AI JSON payloads, third-party shapes). Ratchet them
      // out over time with --max-warnings in CI; don't mass-convert now.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '(useMyEffect|useDebounce)' }],
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': 'off',
      'no-useless-catch': 'off',
      'react-hooks/purity': 'off',
    },
  },
];