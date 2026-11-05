import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Podgląd bez serwera: ta sama aplikacja z odpowiedziami API nagranymi z instancji pokazowej
 * (`npm run preview:record`, potem `npm run build:preview`). Wynik w `dist/preview` — strona z plikami obok siebie,
 * bez ścieżek bezwzględnych, do otwarcia z dowolnego adresu.
 */
export default defineConfig({
  root: 'web',
  base: './',
  // ikony, manifest i service worker PWA nie są potrzebne na stronie podglądu
  publicDir: false,
  plugins: [react()],
  define: { 'import.meta.env.VITE_PREVIEW': JSON.stringify('1') },
  resolve: {
    // zminifikowany worker pdf.js ma w napisach surowe bajty sterujące, a strona podglądu przyjmuje tylko czysty tekst
    alias: [{ find: /^pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs/, replacement: 'pdfjs-dist/legacy/build/pdf.worker.mjs' }],
  },
  build: {
    outDir: '../dist/preview',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: { input: fileURLToPath(new URL('./web/preview.html', import.meta.url)) },
  },
});
