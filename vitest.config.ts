import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["packages/**/*.test.{ts,tsx}", "apps/**/*.test.{ts,tsx}", "tests/*.test.ts"], environment: "jsdom" },
});
