import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /browser\.spec\.ts$/,
  timeout: 30_000,
  use: {baseURL: 'http://127.0.0.1:4176', browserName: 'chromium', headless: true},
  webServer: {
    command: 'pnpm --filter @aeliqo/studio exec vite --host 127.0.0.1',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
