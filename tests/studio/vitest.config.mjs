import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@aeliqo/core': resolve('packages/core/dist/index.js'),
      '@aeliqo/runtime/meaning': resolve('packages/runtime/dist/meaning/index.js'),
      '@aeliqo/runtime': resolve('packages/runtime/dist'),
    },
  },
  test: {environment: 'node', include: ['tests/studio/**/*.test.ts']},
});
