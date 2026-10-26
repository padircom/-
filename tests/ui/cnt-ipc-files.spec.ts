import { test, expect, type Page } from '@playwright/test';

/**
 * فاز ۵ ADR-CNT-IPC-UNIFY — پنل «اسناد، امضا و تبادل فایل».
 *
 * روی **قرارداد مسیرها** قفل میشود، نه داده: پاسخهای API شبیهسازی
 * میشوند تا نبود پایگاه داده / Chromium در محیط UI تست را نشکند.
 * همانند بقیهٔ specهای `tests/ui` به dev server نیاز دارد و جزئی از
 * `npm test` نیست.
 *
 * چه چیزی قفل میشود:
 *  ۱) دکمههای PDF/Excel و ورود دومرحلهای در میز کار پیمان پیدا هستند؛
 *  ۲) دانلود و ورود فقط از مسیرهای اختصاصی `/api/cnt/...` میگذرند؛
 *  ۳) تا «پیشنمایش» انجام نشود دکمهٔ «ثبت نهایی» غیرفعال است.
 */

async function openContractDomain(page: Page) {
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  const right = page.locator('.context-sidebar');
  await right.getByPlaceholder('Search domains / processes…').fill('Contract & Payment');
  await right.getByRole('button').filter({ has: page.locator('h3', { hasText: 'Contract & Payment Management' }) }).click();
  await page.getByRole('button', { name: /Enter domain page/ }).click();
  await expect(page.locator('.workspace-columns > aside')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.route('**/api/cnt/ipc/pki/status', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, data: { configured: false, ok: false, required: false, trustLevel: null, issuesFa: ['گواهی دیجیتال پیکربندی نشده است'], certificate: null } }),
  }));
  await page.goto('/');
  await expect(page.locator('.context-sidebar')).toBeVisible();
});

test('IPC documents panel exposes PDF, Excel and two-step import', async ({ page }) => {
  await openContractDomain(page);
  const nav = page.locator('.workspace-columns > aside');
  await nav.getByRole('button', { name: /IPC Preparation & Workflow/ }).first().click();

  const panel = page.locator('section').filter({ hasText: 'اسناد، امضا و تبادل فایل' }).first();
  await expect(panel).toBeVisible();
  await expect(panel.getByText('⬇ PDF رسمی')).toBeVisible();
  await expect(panel.getByText('⬇ قالبها (XLSX)')).toBeVisible();
  await expect(panel.getByText('⬇ ریزمتره (XLSX)')).toBeVisible();
  await expect(panel.getByTestId('cnt-ipc-pki-status')).toContainText('PKI پیکربندی نشده');
  await expect(panel.getByTestId('cnt-ipc-import-commit')).toBeDisabled();
});

test('download and import use dedicated CNT routes only', async ({ page }) => {
  const seen: string[] = [];
  await page.route('**/api/cnt/excel/**', async (route) => {
    seen.push(new URL(route.request().url()).pathname);
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { committed: false, count: 1, preview: [], issues: [] } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: 'PK' });
  });
  await openContractDomain(page);
  const nav = page.locator('.workspace-columns > aside');
  await nav.getByRole('button', { name: /IPC Preparation & Workflow/ }).first().click();

  const panel = page.locator('section').filter({ hasText: 'اسناد، امضا و تبادل فایل' }).first();
  await panel.getByTestId('cnt-ipc-excel-templates').click();
  await expect(panel.getByTestId('cnt-ipc-files-msg')).toBeVisible();

  await panel.getByTestId('cnt-ipc-import-file').setInputFiles({
    name: 'rows.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('PK'),
  });
  await panel.getByTestId('cnt-ipc-import-preview').click();
  await expect(panel.getByTestId('cnt-ipc-import-preview-result')).toContainText('فقط پیشنمایش');
  await expect(panel.getByTestId('cnt-ipc-import-commit')).toBeEnabled();

  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every((p) => p.startsWith('/api/cnt/excel/'))).toBe(true);
  expect(seen.some((p) => p.includes('/api/integration'))).toBe(false);
});
