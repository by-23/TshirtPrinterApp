import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  // Cloud deploy serves the panel under /admin/ on the same host as central-relay.
  base: process.env.VITE_ADMIN_BASE || "/",
  resolve: {
    alias: {
      "@tshirt/shared-types": fileURLToPath(
        new URL("../../packages/shared-types/src/index.ts", import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@tshirt/shared-types"],
  },
  server: {
    host: true,
    port: 5174,
  },
});
