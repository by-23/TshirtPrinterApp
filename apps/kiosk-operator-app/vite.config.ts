import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { kioskThemeSavePlugin, resolveIndexCssPath } from "./vite/kioskThemeSavePlugin.js";

const configDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), kioskThemeSavePlugin(resolveIndexCssPath(configDir))],
  resolve: {
    alias: {
      // Workspace packages ship `dist/` — Vite otherwise keeps a stale prebundle
      // after src edits until a full rebuild/restart.
      "@tshirt/shared-pricing": fileURLToPath(
        new URL("../../packages/shared-pricing/src/index.ts", import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@tshirt/shared-pricing"],
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // Cursor/Windows often miss atomic saves; without this the kiosk keeps
      // serving the previous module until a manual refresh.
      usePolling: true,
      interval: 400,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/fabric")) return "fabric";
          if (id.includes("node_modules/swiper")) return "swiper";
          if (id.includes("node_modules/socket.io-client")) return "socket";
          if (id.includes("node_modules/@imgly/background-removal")) return "bg-removal";
          return undefined;
        },
      },
    },
  },
});
