import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        // Copy manifest.json
        if (fs.existsSync('extension/manifest.json')) {
          fs.copyFileSync('extension/manifest.json', 'dist/manifest.json');
        }
        // Copy icons directory
        if (fs.existsSync('icons')) {
          fs.cpSync('icons', 'dist/icons', { recursive: true });
        }
        // Copy rules directory if it exists
        if (fs.existsSync('extension/rules')) {
          fs.cpSync('extension/rules', 'dist/rules', { recursive: true });
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'extension/popup/index.html'),
        options: resolve(__dirname, 'extension/options/index.html'),
        blocked: resolve(__dirname, 'extension/blocked/index.html'),
        'background/service-worker': resolve(__dirname, 'extension/background/service-worker.ts'),
        'content/content': resolve(__dirname, 'extension/content/content.ts'),
        'content/element-picker': resolve(__dirname, 'extension/content/element-picker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/service-worker') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content/content') {
            return 'content/content.js';
          }
          if (chunkInfo.name === 'content/element-picker') {
            return 'content/element-picker.js';
          }
          return '[name]/index.js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
