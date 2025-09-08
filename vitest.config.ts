import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.ts"],
    globals: true,
    coverage: {
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
    },
  },
});