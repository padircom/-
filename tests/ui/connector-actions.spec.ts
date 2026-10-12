import { test, expect, type Page } from '@playwright/test';

/**
 * دکمه‌های منابع دادهٔ بیرونی، سرِ جای واقعی خودشان.
 *
 * پنل/کشوی «منابع داده» به‌طور کامل از صفحهٔ اصلی حذف شد؛ حالا:
 *  «برنامه‌ریزی ➔ زمان‌بندی/گانت»      → Import P6 (XER) / Import MSP (MPP)
 *  «پایش و کنترل ➔ کنترل هزینه»       → همگام‌سازی با ERP / SAP
 *  «پایش و کنترل ➔ داشبوردها و گزارشات» → خروجی / اتصال به Power BI
 *
 * این spec دو چیز را قفل می‌کند: (۱) جای درست دکمه‌ها، (۲) صداقت رفتارشان —
 * عددهای گزارش‌شده از پاسخ واقعی سرور می‌آیند و کانکتور تنظیم‌نشده درخواست
 * بی‌حاصل نمی‌فرستد.
 */

const schedulePanel = (page: Page) => page.locator('[data-connector-actions="schedule-import"]');
const erpPanel = (page: Page) => page.locator('[data-connector-actions="erp-sync"]');
const pbiPanel = (page: Page) => page.locator('[data-connector-actions="powerbi"]');

async function english(page: Page) {
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
}

async function openSchedule(page: Page) {
  await english(page);
  await page.getByRole('button', { name: '🧭 Planning & Execution', exact: true }).click();
  await page.getByRole('button', { name: /Enter domain page/ }).click();
  const nav = page.locator('.workspace-columns > aside');
  await nav.getByRole('button', { name: 'Baseline Schedule', exact: true }).click();
  await expect(schedulePanel(page)).toBeVisible();
}

async function openCostControl(page: Page) {
  await english(page);
  const right = page.locator('.context-sidebar');
  await right.getByPlaceholder('Search domains / processes…').fill('Cost, Procurement');
  await right.getByRole('button').filter({ has: page.locator('h3', { hasText: 'Cost, Procurement & Logistics' }) }).click();
  await page.getByRole('button', { name: /Enter domain page/ }).click();
  await page.locator('.workspace-columns > aside').getByRole('button', { name: 'Actual Cost', exact: true }).click();
  await expect(erpPanel(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/');
  // کشوی حذف‌شده نباید در هیچ حالتی برگردد.
  await expect(page.locator('.sources-sidebar')).toHaveCount(0);
});

test('schedule import buttons sit on the planning/gantt page, not in a panel', async ({ page }) => {
  await page.route('**/api/integrations/status', route => route.fulfill({ json: { ok: true, data: [
    { id: 'p6', configured: true, mode: 'api' },
    { id: 'msp', configured: true, mode: 'file-import' },
  ] } }));
  let uploads = 0;
  await page.route('**/api/projects/**/schedule/import', route => {
    uploads += 1;
    return route.fulfill({ json: { ok: true, data: { importedActivities: 42, sourceSystem: 'primavera', fileName: 'plan.xer' } } });
  });
  await openSchedule(page);

  await expect(schedulePanel(page).getByRole('button', { name: 'Import P6 (XER)' })).toBeVisible();
  await expect(schedulePanel(page).getByRole('button', { name: 'Import MSP (MPP)' })).toBeVisible();
  await expect(schedulePanel(page).locator('[data-connector="p6"]')).toBeVisible();
  await expect(schedulePanel(page).locator('[data-connector="msp"]')).toBeVisible();
  // ورود فایل، اتصال زنده نیست: MSP با ورود فایل هرگز سبز نمی‌شود.
  await expect(schedulePanel(page).locator('[data-connector="msp"]')).toHaveAttribute('data-health', 'disconnected');
  await expect(schedulePanel(page).locator('[data-connector="msp"]')).toHaveAttribute('title', /not a live connection/);

  await schedulePanel(page).locator('[data-testid="import-p6-file"]')
    .setInputFiles({ name: 'plan.xer', mimeType: 'text/plain', buffer: Buffer.from('ERMHDR\t19.12\n') });
  const note = schedulePanel(page).locator('[role="status"]');
  await expect(note).toContainText('42');   // عدد از پاسخ همان درخواست می‌آید
  await expect(note).toContainText('Primavera P6');
  expect(uploads).toBe(1);
});

test('unconfigured ERP sync explains itself and never fires a request', async ({ page }) => {
  await page.route('**/api/integrations/status', route => route.fulfill({ json: { ok: true, data: [
    { id: 'sap', configured: false, mode: 'rest-odata' },
  ] } }));
  let calls = 0;
  await page.route('**/api/integrations/sap/sync', route => { calls += 1; return route.fulfill({ status: 500, json: { ok: false } }); });
  await openCostControl(page);

  await expect(erpPanel(page).getByRole('button', { name: 'Sync with ERP / SAP' })).toBeVisible();
  await expect(erpPanel(page).locator('[data-connector="sap"]')).toHaveAttribute('data-health', 'disconnected');
  await erpPanel(page).getByRole('button', { name: 'Sync with ERP / SAP' }).click();
  await expect(erpPanel(page).locator('[role="status"]')).toContainText(/not configured/i);
  expect(calls).toBe(0);
});

test('configured ERP sync reports the real response, not an assumed success', async ({ page }) => {
  const at = new Date('2026-09-29T10:00:00Z');
  const now = Date.now();
  await page.route('**/api/integrations/status', route => route.fulfill({ json: { ok: true, data: [
    { id: 'sap', configured: true, mode: 'rest-odata', connected: true, checkedAt: new Date(now).toISOString(), latencyMs: 31 },
  ] } }));
  let calls = 0;
  await page.route('**/api/integrations/sap/sync', route => {
    calls += 1;
    return route.fulfill({ json: { ok: true, data: {
      source: 'sap', endpoint: 'https://erp.example/api/costs', httpStatus: 200,
      recordCount: 7, shape: 'envelope', runAt: at.toISOString(),
    } } });
  });
  await openCostControl(page);

  await expect(erpPanel(page).locator('[data-connector="sap"]')).toHaveAttribute('data-health', 'connected');
  await erpPanel(page).getByRole('button', { name: 'Sync with ERP / SAP' }).click();
  const note = erpPanel(page).locator('[role="status"]');
  await expect(note).toContainText('200');
  await expect(note).toContainText('7');
  expect(calls).toBe(1);
});

test('Power BI export/connect lives on the dashboards and reports page', async ({ page }) => {
  await page.route('**/api/integrations/status', route => route.fulfill({ json: { ok: true, data: [{ id: 'powerbi', configured: true, mode: 'embedded' }] } }));
  await english(page);
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(pbiPanel(page)).toBeVisible();
  await expect(pbiPanel(page).getByRole('button', { name: 'Export / Connect to Power BI' })).toBeVisible();
  await expect(pbiPanel(page).locator('[data-connector="pbi"]')).toHaveAttribute('data-health', 'unknown');
  // هیچ ادعای «اتصال زنده» یا «push» بدون تأیید سرور.
  await expect(pbiPanel(page)).toContainText('Power BI');
});
