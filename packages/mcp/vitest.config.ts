import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // The stdio entry point only connects the server to a transport; the server itself is tested in process.
      exclude: ['src/bin.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 90, branches: 70, functions: 90, statements: 85 },
    },
  },
});
