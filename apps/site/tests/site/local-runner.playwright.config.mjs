import { defineConfig } from '@playwright/test';
import { testPort } from '../shared/port.mjs';

const port = await testPort('AELIQO_LOCAL_RUNNER_TEST_PORT');
const token = 'aeliqo-local-runner-test-token';

export default defineConfig({
  testDir: '.',
  testMatch: 'local-runner.spec.ts',
  workers: 1,
  timeout: 45_000,
  outputDir: '../../artifacts/local-runner/test-output',
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', trace: 'retain-on-failure' },
  metadata: { token },
  webServer: {
    command: `AELIQO_PLAYGROUND_PORT=${port} AELIQO_MCP_TOKEN=${token} pnpm --dir ../../../playground start`,
    url: `http://127.0.0.1:${port}/playground/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
