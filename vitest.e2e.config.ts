import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 180000,
    hookTimeout: 180000,
    threads: false,
    singleThread: true,
  },
});
