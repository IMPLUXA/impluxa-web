import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "jsdom", globals: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only throws in non-server envs — no-op in tests
      "server-only": path.resolve(
        __dirname,
        "./tests/__mocks__/server-only.ts",
      ),
    },
  },
});
