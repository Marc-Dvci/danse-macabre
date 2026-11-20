import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5318",
    viewport: { width: 1440, height: 900 },
    // The pose model runs on the GPU delegate where one is available, as in a desktop browser.
    launchOptions: process.env.CI ? {} : { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  },
  webServer: {
    command: "pnpm exec vite --port 5318 --strictPort",
    url: "http://localhost:5318",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
