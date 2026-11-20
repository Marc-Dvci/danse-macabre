import { defineConfig } from 'vitest/config';

// Property tests run 200 cases that each generate frames at 30 fps, so the default 5 s timeout is too short.
export default defineConfig({
  test: {
    testTimeout: 120_000,
  },
});
