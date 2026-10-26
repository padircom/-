import { test, expect, type Page } from '@playwright/test';

/**
 * مسیریابی صورت‌وضعیت در d14 — تفکیک دفتر اصلی از قالب‌ساز CNT-1.
 *
 * چه چیزی قفل می‌شود:
 *  ۱) زیرفرایند «تهیه و گردش صورت‌وضعیت» (d14-p2-s2) به بخش
 *     «صورت‌وضعیت پیمانکار اصلی» در میز کار پیمان می‌رسد (موتور
 *     BOQمحور / InterimPaymentCertificate)، نه به پنل قالب.
 *  ۲) نمای «قالب‌های صورت‌وضعیت» (CNT-1) فقط از میان‌بر خودش در
 *     سایدبار باز می‌شود و حذف نشده است.
 *
 * assertionها روی مسیریابی و عنوان بخش‌اند، نه داده؛ پس نبود API یا
 * پیمان در محیط آزمون این spec را نمی‌شکند. مثل بقیهٔ تست‌های
 * `tests/ui` نیازمند dev server است و جزئی از `npm test` نیست.
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
  await page.goto('/');
  await expect(page.locator('.context-sidebar')).toBeVisible();
});

test('IPC preparation & workflow opens the main IPC section, not the template panel', async ({ page }) => {
  await openContractDomain(page);
  const nav = page.locator('.workspace-columns > aside');

  await nav.getByRole('button', { name: /IPC Preparation & Workflow/ }).first().click();

  await expect(page.getByText('Main IPC & workflow').first()).toBeVisible();
  await expect(page.getByText(/IPC template & period certificate/)).toHaveCount(0);
});

test('IPC templates stay reachable from their sidebar shortcut', async ({ page }) => {
  await openContractDomain(page);
  const nav = page.locator('.workspace-columns > aside');

  await nav.getByRole('button', { name: /IPC templates/ }).first().click();

  await expect(page.getByText(/IPC template & period certificate/).first()).toBeVisible();
});
