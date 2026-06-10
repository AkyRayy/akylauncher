/**
 * Web-preview сборка: один автономный HTML-файл с инлайн JS/CSS/шрифтами/иконками.
 * Реальный IPC заменяется мок-мостом (bridge.ts сам определяет окружение).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'src/renderer',
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  build: {
    outDir: resolve(__dirname, '../preview'),
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000
  }
});
