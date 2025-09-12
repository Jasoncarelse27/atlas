import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setupTests.ts'],
    globals: true,
    exclude: [
      'tests/e2e/**/*', // Exclude E2E tests from Vitest
      'node_modules/**/*', // Exclude node_modules tests
      'atlas-mobile/**/*', // Exclude mobile app tests
      'deploy/**/*', // Exclude deploy tests
    ],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
    },
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    // Add polyfills for Node.js compatibility
    define: {
      global: 'globalThis',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});