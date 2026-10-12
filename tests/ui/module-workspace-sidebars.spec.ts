import { test, expect } from '@playwright/test';

/**
 * رفتار سایدبار اصلی فرمت (`.context-sidebar`) در چهار ماژول سازمانی جدید
 * (MES, CMMS, SCM, IIoT) باید دقیقاً مثل صفحات حوزهٔ PMIS باشد:
 * با ورود به فضای کاری ماژول، سایدبار اصلی از DOM خارج می‌شود (نه جمع‌شده —
 * حذف‌شده)، فقط فضای کاری و دکمهٔ «بازگشت به نمای اصلی» باقی می‌ماند و با
 * کلیک روی آن سایدبار اصلی برمی‌گردد.
 *
 * پیش از اصلاح، چهار ماژول از `activeSystemView.system` ردیف می‌شدند (نه
 * `moduleNav`) و شرط قدیمی `!moduleNav` سایدبار اصلی را کنار فضای کاری
 * نگه می‌داشت — دو ستون ناوبری هم‌زمان و ۳۲۰ پیکسل فضای از‌دست‌رفته.
 */

const EN_MODULE_SECTIONS = [
  { regex: /Manufacturing Execution/ },
  { regex: /Maintenance Management/ },
  { regex: /Supply Chain, Commercial/ },
  { regex: /Field Monitoring/ },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.goto('/');
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('.context-sidebar')).toBeVisible();
});

for (const section of EN_MODULE_SECTIONS) {
  test(`main sidebar hides inside the module workspace and returns via back button: ${section.regex.source}`, async ({ page }) => {
    const right = page.locator('.context-sidebar');
    const header = right.getByRole('button', { name: section.regex });
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    // اولین زیرفرآیند همان سرگروه
    await header.locator('xpath=following-sibling::div[1]').locator('button').first().click();

    // سایدبار اصلی حذف شده است (نه collapse: اصلاً رندر نمی‌شود)
    await expect(page.locator('.context-sidebar')).toHaveCount(0);
    await expect(page.locator('.sources-sidebar')).toHaveCount(0);

    // فضای کاری + دکمهٔ بازگشت باقی‌مانده
    const back = page.getByRole('button', { name: 'Back to Hub', exact: true });
    await expect(back).toBeVisible();
    const box = (await page.locator('.app-main > section').boundingBox())!;
    // عرض کامل بدون ستون ۳۲۰ پیکسلی سایدبار
    expect(box.width).toBeGreaterThanOrEqual(1100);

    await back.click();
    await expect(right).toBeVisible();
  });
}

test('parity with PMIS: main sidebar hides on the domain page too', async ({ page }) => {
  const right = page.locator('.context-sidebar');
  await right.getByPlaceholder('Search domains / processes…').fill('Planning & Execution');
  const domainButton = right.getByRole('button').filter({ has: page.locator('h3', { hasText: 'Planning & Execution' }) });
  await domainButton.click();
  await right.getByRole('button', { name: /Enter domain page/ }).click();

  await expect(page.locator('.context-sidebar')).toHaveCount(0);
  const back = page.getByRole('button', { name: 'Back to dashboard', exact: true });
  await expect(back).toBeVisible();
  await back.click();
  await expect(right).toBeVisible();
});
