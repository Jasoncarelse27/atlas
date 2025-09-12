import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setupTests.ts'],
    globals: true,
    exclude: ['tests/e2e/**/*'], // Exclude E2E tests from Vitest
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});