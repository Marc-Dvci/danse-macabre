import { defineConfig } from 'vitest/config';

// Property tests run 200 cases that each generate frames at 30 fps, so the default 5 s timeout is too short.
export default defineConfig({
  test: {
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 95, branches: 90, functions: 95, statements: 95 },
    },
  },
});
