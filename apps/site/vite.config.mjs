import {defineConfig} from 'vite';
import {generatePages} from './generate-pages.mjs';
export default defineConfig(async()=>({build:{rollupOptions:{input:await generatePages()}},server:{host:'127.0.0.1'}}));
