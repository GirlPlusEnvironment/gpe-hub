import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }
          if (
            id.includes("@radix-ui") ||
            /node_modules\/(?:\.pnpm\/)?react\//.test(id) ||
            /node_modules\/(?:\.pnpm\/)?react-dom\//.test(id) ||
            /node_modules\/(?:\.pnpm\/)?scheduler\//.test(id)
          ) {
            return "vendor-react";
          }
          if (id.includes("react-router")) {
            return "vendor-router";
          }
          if (id.includes("@tanstack")) {
            return "vendor-tanstack";
          }
          if (id.includes("date-fns")) {
            return "vendor-date";
          }
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) {
            return "vendor-forms";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          return undefined;
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
