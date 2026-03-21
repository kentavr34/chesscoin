import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  assetsInclude: ['**/*.svg'],
  server: {
    port: 5173,
    proxy: {
      "/api/v1": "http://localhost:3000",
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 800,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Только тяжёлые либы в отдельные чанки, React остаётся вместе
            if (id.includes('lightweight-charts')) return 'charts';
            if (id.includes('@tonconnect'))        return 'tonconnect';
            if (id.includes('chess.js'))            return 'chess-logic';
            return 'vendor';
          }
        },
      },
    },
  },
});
