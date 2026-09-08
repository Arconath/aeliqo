import {fileURLToPath} from 'node:url';
import {defineConfig} from '@playwright/test';
import {testPort} from '../shared/port.mjs';
const port=await testPort('AELIQO_VISUAL_PORT');
export default defineConfig({testDir:'.',testMatch:['catalog.spec.ts','field-states.spec.ts'],workers:1,timeout:30000,outputDir:'../../artifacts/visual-catalog',reporter:[['list'],['json',{outputFile:fileURLToPath(new URL('../../artifacts/visual-catalog/results.json',import.meta.url))}]],projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'firefox',use:{browserName:'firefox'}},{name:'webkit',use:{browserName:'webkit'}}],use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',locale:'en-US',timezoneId:'UTC',deviceScaleFactor:1},webServer:{cwd:fileURLToPath(new URL('../../',import.meta.url)),command:`pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}/tests/visual/index.html`,reuseExistingServer:false,timeout:30000}});
