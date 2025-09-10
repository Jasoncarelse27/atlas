/* eslint-disable @typescript-eslint/no-unused-vars */
import js from "@eslint/js";
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react-hooks': reactHooks,
      'react': react,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off',
      'no-console': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-no-useless-fragment': 'warn',
      'react/no-unstable-nested-components': 'warn',
    },
  },

  // --- Node backend overrides (ESM .mjs) ---
  {
    files: ["server.mjs", "backend/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        // Node globals for ESM
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-undef": "off",           // ESM/Node globals handled above
      "no-console": "off",         // allow logging on backend
    },
  },

  // --- Vitest overrides for test files ---
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    languageOptions: {
      globals: {
        // vitest globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
    },
    rules: {
      "no-console": "off",          // tests can log for diagnostics
      "@typescript-eslint/no-unused-expressions": "off", // common in assertions
    },
  },

  // === Injected by cleanup ===
  // ✅ Backend-only overrides (Node environment)
  {
    files: ['backend/**/*.mjs', 'server.mjs', '**/sentry.node.js', '**/sentry.node.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',            // logs OK on the server
      'no-undef': 'off',              // Node globals handled via globals
    },
  },

  // ✅ Tests can be looser
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',  // allow pragmatic ts-ignore in tests
      '@typescript-eslint/no-unused-expressions': ['error', { allowTaggedTemplates: true, allowShortCircuit: true, allowTernary: true }],
      'no-useless-catch': 'off', // tests often assert thrown flows verbosely
    },
  },
  // === End injected ===

  {
    ignores: [
      'dist', 
      'node_modules', 
      '*.config.js', 
      'venv/**/*',
      'atlas-mobile/**/*',
      'App.js',
      'test-*.js',
      '*.cjs',
      'backend/**/*',
      'scripts/**/*',
      '*.mjs',
      'deploy-config.js',
      'main.mjs',
      'preload.mjs',
      'backups/**/*'
    ],
  },
];
