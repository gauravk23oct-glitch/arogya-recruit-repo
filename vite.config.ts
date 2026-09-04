import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    // HMR is handled by the server's createViteServer middleware in middlewareMode.
    // You can set HMR options here if you need a custom host/port for remote dev.
  },
});
