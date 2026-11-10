import { build } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { buildAllRules } from './build-rules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

async function buildAll() {
  console.log('[build-extension] Starting production build...');

  // 1. Build UI pages (popup, options, blocked)
  console.log('[build-extension] 1/4 Building UI pages...');
  await build({
    configFile: false,
    root: rootDir,
    plugins: [react()],
    base: '',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: path.resolve(rootDir, 'extension/popup/index.html'),
          options: path.resolve(rootDir, 'extension/options/index.html'),
          blocked: path.resolve(rootDir, 'extension/blocked/index.html'),
        },
      },
    },
  });

  // Move HTML files from dist/extension/* to dist/* if nested
  const nestedExtensionDir = path.join(distDir, 'extension');
  if (fs.existsSync(nestedExtensionDir)) {
    const pages = ['popup', 'options', 'blocked'];
    for (const page of pages) {
      const srcHtml = path.join(nestedExtensionDir, page, 'index.html');
      const destDir = path.join(distDir, page);
      const destHtml = path.join(destDir, 'index.html');
      if (fs.existsSync(srcHtml)) {
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(srcHtml, destHtml);
      }
    }
    fs.rmSync(nestedExtensionDir, { recursive: true, force: true });
  }

  // 2. Build Background Service Worker (ES module)
  console.log('[build-extension] 2/4 Building Background Service Worker...');
  await build({
    configFile: false,
    root: rootDir,
    base: '',
    build: {
      outDir: path.join(distDir, 'background'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'extension/background/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 3. Build Content Scripts (Self-contained IIFE - required for Chrome content scripts)
  console.log('[build-extension] 3/4 Building Content Scripts (IIFE)...');
  await build({
    configFile: false,
    root: rootDir,
    base: '',
    build: {
      outDir: path.join(distDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'extension/content/content.ts'),
        formats: ['iife'],
        name: 'AdBlockerContentScript',
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  await build({
    configFile: false,
    root: rootDir,
    base: '',
    build: {
      outDir: path.join(distDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'extension/content/element-picker.ts'),
        formats: ['iife'],
        name: 'AdBlockerElementPicker',
        fileName: () => 'element-picker.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 4. Build DNR static rules and copy static assets
  console.log('[build-extension] 4/4 Generating rules and packaging manifest...');
  buildAllRules();

  // Copy manifest.json
  fs.copyFileSync(
    path.resolve(rootDir, 'extension/manifest.json'),
    path.resolve(distDir, 'manifest.json')
  );

  // Copy icons
  const iconsDist = path.resolve(distDir, 'icons');
  if (!fs.existsSync(iconsDist)) fs.mkdirSync(iconsDist, { recursive: true });
  fs.cpSync(path.resolve(rootDir, 'icons'), iconsDist, { recursive: true });

  // Copy rules to dist/rules
  const rulesDist = path.resolve(distDir, 'rules');
  if (!fs.existsSync(rulesDist)) fs.mkdirSync(rulesDist, { recursive: true });
  fs.cpSync(path.resolve(rootDir, 'extension/rules'), rulesDist, { recursive: true });

  console.log('[build-extension] Build completed successfully. Extension ready in dist/');
}

buildAll().catch((err) => {
  console.error('[build-extension] Build failed:', err);
  process.exit(1);
});
