import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  server: { proxy: { "/api": "http://127.0.0.1:4000" } },
  preview: {
    proxy: {
      "/api": `http://127.0.0.1:${process.env.DEVDESK_PREVIEW_API_PORT ?? "4000"}`,
    },
  },
});
