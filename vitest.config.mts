import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Las pruebas de aislamiento usan la base local: se ejecutan una tras otra.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
