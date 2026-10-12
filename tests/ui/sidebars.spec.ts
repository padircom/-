import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * سایدبار اصلی (`.context-sidebar`) — بدون کشوی «منابع داده».
 *
 * پنل منابع داده به‌طور کامل از صفحهٔ اصلی حذف شده است (نه جمع‌شده)؛ دکمه‌های
 * ورود فایل برنامه، همگام‌سازی ERP و خروجی Power BI به صفحات تخصصی خودشان
 * منتقل شده‌اند و تست آن‌ها در `connector-actions.spec.ts` است. این فایل فقط
 * قرارداد باقی‌ماندهٔ سایدبار را قفل می‌کند: عرض ثابت، نبود دکمهٔ پنهان‌سازی،
 * جستجوی پایدار و عناوین ۵ سرگروه اصلی بدون کادر.
 */

const context = (page: Page) => page.locator('.context-sidebar');

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/');
  await expect(context(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('the removed data-sources panel leaves no rail, toggle or row behind', async ({ page }) => {
  await expect(page.locator('.sources-sidebar')).toHaveCount(0);
  await expect(page.locator('.sidebar-toggle')).toHaveCount(0);
  await expect(page.locator('.sidebar-dock')).toHaveCount(0);
  await expect(page.locator('.source-row')).toHaveCount(0);
  await expect(page.locator('[data-collapsed]')).toHaveCount(0);
  // تنها داک باقی‌مانده سایدبار زمینه (راست) است، نه کشوی منابع داده.
  await expect(page.locator('.sidebar-dock')).toHaveCount(1);
  await expect(page.locator('.sidebar-dock')).toHaveClass(/context-sidebar/);
});

test('the context sidebar keeps a fixed 320px dock and never gets a hide control', async ({ page }) => {
  const right = context(page);
  await expect(right).toHaveCSS('width', '320px');
  await expect(right.locator(':scope > .sidebar-toggle')).toHaveCount(0);
  const workspace = (await page.locator('.app-main > section').boundingBox())!;
  const dock = (await right.boundingBox())!;
  expect(dock.x).toBeGreaterThanOrEqual(workspace.x + workspace.width - 1);
  await page.getByRole('button', { name: 'Light theme', exact: true }).click();
  await expect(right).toHaveCSS('width', '320px');
  await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  await expect(right).toHaveCSS('width', '320px');
});

test('context sidebar search survives a language switch', async ({ page }) => {
  const search = context(page).locator('input');
  await search.fill('P6');
  await expect(context(page)).toHaveCSS('width', '320px');
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  await expect(search).toHaveValue('P6');
  await expect(context(page)).toHaveCSS('width', '320px');
  await page.locator('.app-header').getByRole('button', { name: 'فارسی', exact: true }).click();
  await expect(search).toHaveValue('P6');
});

for (const width of [1024, 390]) {
  test(`no horizontal overflow with the sidebar docked at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(context(page)).toBeVisible();
  });
}

/* Top-level groups (PMIS, MES, CMMS, SCM, IIoT): plain headings, no card frame. */
const groupTitles = (page: Page) => context(page).locator('.sidebar-group-title');
const arrowState = (chevron: Locator) => chevron.evaluate(node => {
  const s = getComputedStyle(node);
  return [s.transform, s.getPropertyValue('rotate')].join(' / ');
});

test('the five main group titles are flat: no border, radius, shadow or background box', async ({ page }) => {
  const titles = groupTitles(page);
  await expect(titles).toHaveCount(5);
  for (const title of await titles.all()) {
    await expect(title).toHaveCSS('border-width', '0px');
    await expect(title).toHaveCSS('border-radius', '0px');
    await expect(title).toHaveCSS('box-shadow', 'none');
    await expect(title).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    // icon, label and collapse arrow stay in place
    await expect(title.locator('svg')).toHaveCount(1);
    await expect(title.locator('span').first()).not.toBeEmpty();
  }
});

test('the active module keeps a text accent instead of the removed colour box', async ({ page }) => {
  for (const theme of ['Dark theme', 'Light theme']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    const titles = groupTitles(page);
    await expect(titles).toHaveCount(5);
    const [active, inactive] = [titles.nth(0), titles.nth(1)];
    const color = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).color);
    expect(await color(active)).not.toBe(await color(inactive));
    for (const title of [active, inactive]) {
      await expect(title).toHaveCSS('border-width', '0px');
      await expect(title).toHaveCSS('box-shadow', 'none');
      await expect(title).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
  }
});

test('group titles keep their icon, label, arrow rotation and accordion behaviour', async ({ page }) => {
  const first = groupTitles(page).first();
  const label = (await first.locator('span').nth(1).textContent())!;
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  const closed = await arrowState(first.locator('svg'));
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  // same heading element, same label; only the accordion state changed
  await expect(first.locator('span').nth(1)).toHaveText(label);
  const panel = first.locator('xpath=following-sibling::div[1]');
  await expect(panel).toBeVisible();
  expect(await arrowState(first.locator('svg'))).not.toBe(closed);
  await expect(panel.locator('button').first()).toBeVisible();
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
});
