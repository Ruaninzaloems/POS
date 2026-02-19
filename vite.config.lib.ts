import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, "client/src/mount.ts"),
      name: "PosApp",
      fileName: () => "bundle.js",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        exports: "named",
        inlineDynamicImports: true,
        assetFileNames: "bundle.[ext]",
      },
    },
    cssCodeSplit: false,
  },
});
