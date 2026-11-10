import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../dist');

test.describe('Advanced AdBlocker Extension E2E', () => {
  test('extension builds valid manifest and loads service worker in Chromium', async () => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    try {
      // Allow service worker to initialize
      let [background] = context.serviceWorkers();
      if (!background) {
        background = await context.waitForEvent('serviceworker', { timeout: 10000 });
      }

      expect(background).toBeDefined();
      expect(background.url()).toContain('service-worker.js');
    } finally {
      await context.close();
    }
  });

  test('popup dashboard renders with protection status', async () => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    try {
      let [background] = context.serviceWorkers();
      if (!background) {
        background = await context.waitForEvent('serviceworker', { timeout: 10000 });
      }

      const extensionId = background.url().split('/')[2];
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/index.html`);

      // Verify title or shield container renders
      await expect(page.locator('text=Advanced Shield')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Ads Blocked')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('options page renders protection layers and settings tabs', async () => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    try {
      let [background] = context.serviceWorkers();
      if (!background) {
        background = await context.waitForEvent('serviceworker', { timeout: 10000 });
      }

      const extensionId = background.url().split('/')[2];
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/options/index.html`);

      await expect(page.locator('text=Advanced Shield Settings')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Protection Layers')).toBeVisible();
      await expect(page.locator('text=YouTube Engine')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

