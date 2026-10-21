import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests unitarios (rápidos, sin BD). Los de integración: vitest.integration.config.mts
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"], exclude: ["src/**/*.int.test.ts", "node_modules/**"] },
});
