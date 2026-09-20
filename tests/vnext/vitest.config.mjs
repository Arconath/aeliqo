import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/vnext/**/*.{test,spec}.ts', 'tests/vnext/**/*.{test,spec}.tsx'],
    passWithNoTests: false,
  },
});
