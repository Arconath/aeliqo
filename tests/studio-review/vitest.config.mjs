import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';

// This review suite deliberately owns its runner so it can be run without
// changing the product's test command or depending on a root package link for
// the workspace packages.
export default defineConfig({
  resolve: {
    alias: {
      '@aeliqo/core': resolve('packages/core/dist/index.js'),
      '@aeliqo/runtime/meaning': resolve('packages/runtime/dist/meaning/index.js'),
      '@aeliqo/runtime': resolve('packages/runtime/dist'),
    },
  },
  test: {environment: 'node', include: ['tests/studio-review/**/*.test.ts']},
});
