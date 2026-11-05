import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
      '/fhir': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
});
