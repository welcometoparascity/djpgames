import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2019',
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
  },
});
