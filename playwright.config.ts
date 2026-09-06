import { defineConfig } from "@playwright/test";
import { availablePort } from "./scripts/browser-test-port";
// Workers inherit the chosen origin so config imports cannot select another port.
const port = process.env.AELIQO_TEST_PREVIEW_PORT ?? String(await availablePort());
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("AELIQO_TEST_PREVIEW_PORT must be a valid loopback port");
process.env.AELIQO_TEST_PREVIEW_PORT = port;
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: origin,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm preview --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
  },
  reporter: "list",
});
