import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  testDir:'.',testMatch:'*.spec.ts',timeout:30_000,
  use:{baseURL:'http://127.0.0.1:4174',browserName:'chromium',trace:'retain-on-failure'},
  webServer:{command:'pnpm --filter @aeliqo/next-platform-fixture start',cwd:fileURLToPath(new URL('../..',import.meta.url)),url:'http://127.0.0.1:4174',reuseExistingServer:false,timeout:120_000},
});
