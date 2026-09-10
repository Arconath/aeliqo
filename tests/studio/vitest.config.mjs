import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@aeliqo/sdk-core': resolve('packages/core/dist/index.js'),
      '@aeliqo/sdk-runtime/meaning': resolve('packages/runtime/dist/meaning/index.js'),
      '@aeliqo/sdk-runtime': resolve('packages/runtime/dist'),
    },
  },
  test: {environment: 'node', include: ['tests/studio/**/*.test.ts']},
});
