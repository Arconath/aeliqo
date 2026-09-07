import {defineConfig} from "@playwright/test";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(configDirectory, "../..");

export default defineConfig({
  testDir: configDirectory,
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "./node_modules/.bin/vite examples/platform --host 127.0.0.1 --port 4173",
    cwd: repositoryRoot,
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
