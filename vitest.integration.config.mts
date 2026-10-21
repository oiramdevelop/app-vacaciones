import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests de integración: usan una BD PostgreSQL real y aislada (`<db>_test`), nunca la de desarrollo.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
    fileParallelism: false, // comparten BD
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
