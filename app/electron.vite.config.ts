import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['utf-8-validate', 'bufferutil']
      }
    },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } }
  },
  preload: {
    build: { outDir: 'out/preload' },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') }
    },
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    plugins: [react()]
  }
});
