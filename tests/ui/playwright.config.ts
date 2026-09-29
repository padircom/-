import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  outputDir: '../../test-results/i18n',
  use: {
    baseURL: process.env.UI_BASE_URL || 'http://127.0.0.1:5173',
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? {
      executablePath: process.env.CHROMIUM_PATH,
      args: ['--no-sandbox'],
    } : {},
  },
});
