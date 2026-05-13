import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        // Next.js page/layout files — no unit test surface
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        // UI-only TSX components — covered in v0.4.0 E2E/component tests
        "src/components/**/*.tsx",
        "src/templates/**/*.tsx",
        // i18n config — runtime-only, no unit test surface
        "src/i18n/**",
        // External service wrappers — tested via mocks in callers
        "src/lib/ratelimit.ts",
        "src/lib/resend.ts",
        "src/lib/turnstile.ts",
        "src/lib/supabase/client.ts",
      ],
      reportsDirectory: "./coverage",
    },
  },
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
