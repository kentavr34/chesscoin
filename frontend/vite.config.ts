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
    chunkSizeWarningLimit: 600,
    // OPT-5: Минификация через esbuild (быстрее terser, по умолчанию)
    minify: 'esbuild',
    // OPT-5: CSS code splitting
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // OPT-5: Оптимальное разбиение — браузер кеширует vendor отдельно
        manualChunks(id) {
          // Тяжёлые библиотеки — отдельные chunks
          if (id.includes('react-dom'))       return 'react-dom';
          if (id.includes('react'))           return 'react-core';
          if (id.includes('react-router'))    return 'router';
          if (id.includes('react-chessboard')) return 'chess-ui';
          if (id.includes('chess.js'))        return 'chess-logic';
          if (id.includes('lightweight-charts')) return 'charts';
          if (id.includes('@tonconnect'))     return 'tonconnect';
          if (id.includes('zustand'))         return 'state';
          // Все остальные node_modules → vendor chunk
          if (id.includes('node_modules'))    return 'vendor';
        },
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',
      },
      // OPT-5: Tree shaking — убираем неиспользуемый код
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },
  },
});
