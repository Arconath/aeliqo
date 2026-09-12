import {fileURLToPath} from 'node:url';
import {defineConfig} from '@playwright/test';
import {testPort} from '../shared/port.mjs';
const browsers=['chromium','firefox','webkit'];
const selectedProject=process.env.AELIQO_VISUAL_PROJECT;
if(selectedProject!==undefined&&!browsers.includes(selectedProject))throw new Error('Unknown AELIQO_VISUAL_PROJECT');
const outputDirectory=`../../artifacts/visual-catalog/${selectedProject??'all'}`;
const port=await testPort('AELIQO_VISUAL_PORT');
export default defineConfig({testDir:'.',testMatch:['catalog.spec.ts','field-states.spec.ts','data-states.spec.ts','structure-states.spec.ts','data-interactions.spec.ts','compound-interactions.spec.ts','visualization-interactions.spec.ts'],workers:1,timeout:60000,outputDir:outputDirectory,reporter:[['list'],['json',{outputFile:fileURLToPath(new URL(`${outputDirectory}/results.json`,import.meta.url))}]],projects:browsers.filter(name=>selectedProject===undefined||name===selectedProject).map(name=>({name,use:{browserName:name}})),use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure',locale:'en-US',timezoneId:'UTC',deviceScaleFactor:1},webServer:{cwd:fileURLToPath(new URL('../../',import.meta.url)),command:`pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}/tests/visual/index.html`,reuseExistingServer:false,timeout:30000}});
