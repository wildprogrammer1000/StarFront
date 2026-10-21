import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(clientDir, "..");
const sharedDir = path.resolve(repoRoot, "shared");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": sharedDir,
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: [repoRoot],
    },
  },
});
