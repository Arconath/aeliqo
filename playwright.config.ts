import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { availablePort } from "./scripts/browser-test-port";
// Workers reuse this run's directory; independent runs must not clean each other's artifacts.
const runId = process.env.AELIQO_TEST_RUN_ID ?? randomUUID();
if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(runId))
  throw new Error("AELIQO_TEST_RUN_ID must be 1–64 ASCII letters, digits, underscores or hyphens, starting with a letter or digit");
process.env.AELIQO_TEST_RUN_ID = runId;
// Workers inherit the chosen origin so config imports cannot select another port.
const port = process.env.AELIQO_TEST_PREVIEW_PORT ?? String(await availablePort());
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("AELIQO_TEST_PREVIEW_PORT must be a valid loopback port");
process.env.AELIQO_TEST_PREVIEW_PORT = port;
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  outputDir: `./test-results/${runId}`,
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: origin,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: `pnpm preview --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
  },
  reporter: "list",
});
