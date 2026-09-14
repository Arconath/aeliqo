import {defineConfig} from '@playwright/test';
import {testPort} from '../shared/port.mjs';
const port=await testPort('AELIQO_STUDIO_REVIEW_PORT');
export default defineConfig({testDir:'.',testMatch:/browser\.spec\.ts$/,workers:1,timeout:30_000,outputDir:'../../artifacts/studio-review-browser',use:{baseURL:`http://127.0.0.1:${port}`,browserName:'chromium',headless:true,trace:'retain-on-failure'},webServer:{command:`pnpm --filter @aeliqo/studio exec vite --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:30_000}});
