import { test, expect } from '@playwright/test';

/**
 * میز کار SCM (سرگروه چهارم) — پوستهٔ مشترک ماژول + زیرماژول‌های CRUD.
 * ═══════════════════════════════════════════════════════════════════════
 * چه چیزی قفل می‌شود:
 *  ۱) با ورود از سرگروه «زنجیره تأمین» فضای کاری ماژول باز می‌شود (نه صفحهٔ حوزه).
 *  ۲) هر پنج زیرماژول SCM عنوان و جدول خودشان را دارند.
 *  ۳) جدول‌ها همان جدول مشترک CRUD‌اند (`DataGrid`) با جستجو و دکمهٔ «ثبت جدید».
 *  ۴) تب مالی برچسب صریح «سند حسابداری نیست» را نگه می‌دارد (مرز صداقت).
 *
 * این spec بخشی از `npm test` نیست (آن فقط server/*.test.mjs را می‌دود)؛ مثل بقیهٔ
 * تست‌های `tests/ui` نیازمند dev server روی پورت 5175 است. اگر API بالا نباشد،
 * جدول‌ها حالت خطا/خالی نشان می‌دهند ولی ساختار پوسته و ناوبری باید سالم بماند،
 * پس assertionها روی ساختار می‌مانند نه روی داده.
 */

const SCM_TABS = [
  { nav: 'Warehouses & Inventory Management', table: 'Warehouses' },
  { nav: 'Purchase Requisitions & Orders', table: 'Material requests (MR)' },
  { nav: 'Sales & Customer Relationship Management (CRM)', table: 'Technical & commercial proposals' },
  { nav: 'Goods Receipt & Issue (GRN / GIN)', table: 'Requisitions (MRC)' },
  { nav: 'Financial Accounting & Costing', table: 'Stock per warehouse' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.goto('/');
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('.context-sidebar')).toBeVisible();
});

async function openScm(page: import('@playwright/test').Page) {
  const right = page.locator('.context-sidebar');
  const header = right.getByRole('button', { name: /Supply Chain, Commercial/ });
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await header.locator('xpath=following-sibling::div[1]').locator('button').first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Supply Chain, Commercial & Financial System/ })).toBeVisible();
}

test('SCM workspace opens from the sidebar and keeps the shared module shell', async ({ page }) => {
  await openScm(page);

  // سایدبار اصلی جای خود را به فضای کاری داده است (مثل MES/CMMS/IIoT)
  await expect(page.locator('.context-sidebar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back to Hub', exact: true })).toBeVisible();

  // هویت و مسیر پروژه روی نوار بالا دیده می‌شود
  await expect(page.getByText(/\/api\/scm\//).first()).toBeVisible();

  // همهٔ پنج زیرماژول در ناوبری ماژول هستند
  for (const tab of SCM_TABS) {
    await expect(page.getByRole('button', { name: tab.nav })).toBeVisible();
  }
});

for (const tab of SCM_TABS) {
  test(`SCM submodule renders its own CRUD grid: ${tab.nav}`, async ({ page }) => {
    await openScm(page);
    await page.getByRole('button', { name: tab.nav }).click();

    // جدول مشترک CRUD با برچسب همان منبع
    await expect(page.getByRole('table', { name: tab.table }).first()).toBeVisible();

    // جستجوی همه‌ستونی همان جدول
    await expect(page.locator('input[type="search"][aria-label="Search"]').first()).toBeVisible();
  });
}

test('SCM finance tab states its boundaries (no accounting ledger)', async ({ page }) => {
  await openScm(page);
  await page.getByRole('button', { name: 'Financial Accounting & Costing' }).click();

  await expect(page.getByText('This panel is not an accounting ledger')).toBeVisible();
  await expect(page.getByText(/no general-ledger, costing or AR\/AP API yet/)).toBeVisible();
});

test('SCM workspace returns to the hub and restores the main sidebar', async ({ page }) => {
  await openScm(page);
  await page.getByRole('button', { name: 'Back to Hub', exact: true }).click();
  await expect(page.locator('.context-sidebar')).toBeVisible();
});
