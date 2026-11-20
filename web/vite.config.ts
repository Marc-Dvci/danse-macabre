import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Codespaces serves the forwarded port from *.app.github.dev.
const allowedHosts = [".app.github.dev"];

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  server: { allowedHosts },
  preview: { allowedHosts },
});
