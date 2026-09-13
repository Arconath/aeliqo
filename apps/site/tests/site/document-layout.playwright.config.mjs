import {defineConfig} from "@playwright/test";
import {resolve} from "node:path";
import {testPort} from "../shared/port.mjs";

const configDirectory = import.meta.dirname;
const repositoryRoot = resolve(configDirectory, "../..");
const port = await testPort("AELIQO_SITE_DOCUMENT_LAYOUT_PORT");
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: configDirectory,
  testMatch: "document-layout.spec.ts",
  timeout: 120_000,
  workers: 1,
  outputDir: resolve(repositoryRoot, "artifacts/site-document-layout"),
  use: {baseURL: origin, browserName: "chromium", trace: "retain-on-failure"},
  webServer: {
    command: `AELIQO_STATIC_ROOT="${resolve(repositoryRoot, "dist")}" AELIQO_LISTEN_ADDR="127.0.0.1:${port}" go run ./deploy/server.go`,
    cwd: repositoryRoot,
    url: `${origin}/docs/components/data.table/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
