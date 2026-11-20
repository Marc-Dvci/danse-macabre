import { defineConfig } from "@playwright/test";

// The scheduled check of the live site. LIVE_URL overrides the address.
export default defineConfig({
  testDir: "e2e-live",
  timeout: 60_000,
  retries: 1,
  use: { baseURL: process.env.LIVE_URL ?? "https://marc-dvci.github.io/danse-macabre/" },
});
