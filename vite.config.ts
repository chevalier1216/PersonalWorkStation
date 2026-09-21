import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/PersonalWorkStation/",
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          interaction: ["@dnd-kit/core"],
          validation: ["zod"],
        },
      },
    },
  },
});
