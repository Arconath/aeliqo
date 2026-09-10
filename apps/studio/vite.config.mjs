import {defineConfig} from 'vite';
import {fileURLToPath, URL} from 'node:url';

const source = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({command}) => ({
  // The dev host can run from a clean checkout before package dist folders
  // exist. Production builds resolve the package exports after the normal
  // package build sequence, so consumer evidence still exercises tarballs.
  ...(command === 'serve' ? {resolve: {alias: {
    '@aeliqo/sdk-core': source('../../packages/core/src/index.ts'),
    '@aeliqo/sdk-devtools': source('../../packages/devtools/src/index.ts'),
    '@aeliqo/sdk-runtime/meaning': source('../../packages/runtime/src/meaning/index.ts'),
    '@aeliqo/sdk-web/register': source('../../packages/web/src/register.ts'),
  }}} : {}),
  server: {port: 4176, strictPort: true},
  build: {target: 'es2022'},
}));
