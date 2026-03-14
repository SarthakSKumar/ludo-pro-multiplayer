import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["localhost", "793d-157-50-199-217.ngrok-free.app"],
  },
  preview: {
    port: 5173,
    host: true,
  },
});
