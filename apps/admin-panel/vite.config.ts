import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Cloud deploy serves the panel under /admin/ on the same host as central-relay.
  base: process.env.VITE_ADMIN_BASE || "/",
  server: {
    host: true,
    port: 5174,
  },
});
