import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5175', // پورت فرانت‌اند برنامه شما
    channel: 'chrome',                // استفاده از کروم سیستم
    headless: true,
  },
});