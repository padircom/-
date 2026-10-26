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
  // A selected contract is required for this panel; an empty backend never renders it.
  await page.route('**/api/cnt/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: Record<string, unknown> = {};
    if (path === '/api/cnt/contracts') data = { contracts: [{ id: 'ui-contract', code: 'UI-1', titleFa: 'پیمان آزمون' }] };
    else if (path === '/api/cnt/contracts/ui-contract') data = { contract: { Id: 'ui-contract' }, items: [] };
    else if (path === '/api/cnt/ipc') data = { items: [{ id: 'ui-ipc', serialNo: 1, periodCode: '2026-10', workflowState: 'approved', workflowStateFa: 'مصوب', nextActions: [] }] };
    else if (path === '/api/cnt/ipc/ui-ipc') data = { header: { Id: 'ui-ipc', SerialNo: 1 }, lines: [], deductions: [], workflow: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
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
  const commits: boolean[] = [];
  await page.route('**/api/cnt/excel/**', async (route) => {
    seen.push(new URL(route.request().url()).pathname);
    if (route.request().method() === 'POST') {
      const commit = new URL(route.request().url()).searchParams.get('commit') === '1';
      commits.push(commit);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { committed: commit, count: 1, preview: [], issues: [] } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: 'PK' });
  });
  await openContractDomain(page);
  const nav = page.locator('.workspace-columns > aside');
  await nav.getByRole('button', { name: /IPC Preparation & Workflow/ }).first().click();

  const panel = page.locator('section').filter({ hasText: 'اسناد، امضا و تبادل فایل' }).first();
  const download = page.waitForEvent('download');
  await panel.getByTestId('cnt-ipc-excel-templates').click();
  expect((await download).suggestedFilename()).toMatch(/xlsx$/);
  await expect(panel.getByTestId('cnt-ipc-files-msg')).toBeVisible();

  await panel.getByTestId('cnt-ipc-import-file').setInputFiles({
    name: 'rows.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('PK'),
  });
  await panel.getByTestId('cnt-ipc-import-preview').click();
  await expect(panel.getByTestId('cnt-ipc-import-preview-result')).toContainText('فقط پیشنمایش');
  await expect(panel.getByTestId('cnt-ipc-import-commit')).toBeEnabled();

  expect(commits).toEqual([false]);
  await panel.getByTestId('cnt-ipc-import-commit').click();
  await expect.poll(() => commits).toEqual([false, true]);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every((p) => p.startsWith('/api/cnt/excel/'))).toBe(true);
  expect(seen.some((p) => p.includes('/api/integration'))).toBe(false);
});


test('official PDF download uses selected IPC; JSON errors do not become downloads', async ({ page }) => {
  const seen: string[] = [];
  await page.route('**/api/cnt/ipc/ui-ipc/pdf*', route => {
    seen.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: 'application/pdf',
      headers: { 'content-disposition': 'attachment; filename="official.pdf"' }, body: '%PDF-test' });
  });
  await openContractDomain(page);
  await page.locator('.workspace-columns > aside').getByRole('button', { name: /IPC Preparation & Workflow/ }).first().click();
  await page.getByRole('button', { name: 'جزئیات', exact: true }).click();
  const panel = page.locator('section').filter({ hasText: 'اسناد، امضا و تبادل فایل' }).first();
  const download = page.waitForEvent('download');
  await panel.getByText('⬇ PDF رسمی', { exact: true }).click();
  expect((await download).suggestedFilename()).toBe('official.pdf');
  expect(seen).toEqual(['/api/cnt/ipc/ui-ipc/pdf']);
  await page.route('**/api/cnt/ipc/ui-ipc/pdf*', route => route.fulfill({ status: 422,
    contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'E-CNT-RPT-LETTERHEAD', message: 'سربرگ ناقص است' } }) }));
  let unexpectedDownload = false;
  page.on('download', () => { unexpectedDownload = true; });
  await panel.getByText('⬇ PDF رسمی', { exact: true }).click();
  await expect(panel.getByTestId('cnt-ipc-files-msg')).toContainText('E-CNT-RPT-LETTERHEAD');
  expect(unexpectedDownload).toBe(false);
});
