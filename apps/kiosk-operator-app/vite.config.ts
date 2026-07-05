import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { kioskThemeSavePlugin, resolveIndexCssPath } from "./vite/kioskThemeSavePlugin.js";

const configDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), kioskThemeSavePlugin(resolveIndexCssPath(configDir))],
  server: {
    port: 5173,
  },
});
