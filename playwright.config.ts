import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, 'dist');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    ...devices['Desktop Chrome'],
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

