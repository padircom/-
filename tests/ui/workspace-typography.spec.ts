import { test, expect, type Page, type Locator } from '@playwright/test';

async function chooseLanguage(page: Page, lang: 'fa' | 'en') {
  await page.locator('.app-header').getByRole('button', { name: lang === 'fa' ? 'فارسی' : 'EN', exact: true }).click();
}
async function fontSize(locator: Locator) {
  return locator.evaluate(el => getComputedStyle(el).fontSize);
}
async function sizes(page: Page) {
  const root = await page.locator('html').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  return { text: `${root * 0.75}px`, title: `${root * 0.875}px` };
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.context-sidebar h3').first()).toBeVisible();
});

for (const lang of ['fa', 'en'] as const) {
  test(`right module labels and monitoring buttons/body share the same size (${lang})`, async ({ page }) => {
    await chooseLanguage(page, lang);
    const expected = await sizes(page);
    const module = page.locator('.context-sidebar h3').first();
    await expect(module).toHaveCSS('font-size', expected.text);
    const bannerSize = await fontSize(page.locator('.app-header h1'));
    const sourceSize = await fontSize(page.locator('[data-source-id="p6"] .tx1'));
    await page.getByRole('button', { name: lang === 'fa' ? 'گزارش عملکرد' : 'Reports', exact: true }).click();
    const workspace = page.locator('.app-main > section');
    const refresh = workspace.getByRole('button', { name: lang === 'fa' ? 'تازه‌سازی' : 'Refresh', exact: true });
    await expect(refresh).toBeVisible();
    await expect(refresh).toHaveCSS('font-size', expected.text);
    for (const tab of await workspace.locator('nav button').all()) {
      await expect(tab).toHaveCSS('font-size', expected.text);
    }
    await expect(workspace.locator('header h3')).toHaveCSS('font-size', expected.title);
    await expect(workspace.locator('header label').first()).toHaveCSS('font-size', expected.text);
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      await expect(module).toHaveCSS('font-size', expected.text);
      await expect(refresh).toHaveCSS('font-size', expected.text);
      await expect(workspace.locator('header h3')).toHaveCSS('font-size', expected.title);
    }
    await expect(page.locator('.app-header h1')).toHaveCSS('font-size', bannerSize);
    await expect(page.locator('[data-source-id="p6"] .tx1')).toHaveCSS('font-size', sourceSize);
  });

  test(`inner process/subprocess labels and central workspace text share the token (${lang})`, async ({ page }) => {
    await chooseLanguage(page, 'en');
    await page.getByRole('button', { name: '🧭 Planning & Execution', exact: true }).click();
    await page.getByRole('button', { name: /Enter domain page/ }).click();
    const columns = page.locator('.workspace-columns');
    await expect(columns).toBeVisible();
    await chooseLanguage(page, lang);
    const expected = await sizes(page);
    const labels = columns.locator(':scope > aside button .truncate');
    expect(await labels.count()).toBeGreaterThan(5);
    for (const label of await labels.all()) await expect(label).toHaveCSS('font-size', expected.text);
    const tabs = columns.locator(':scope > div nav button');
    expect(await tabs.count()).toBeGreaterThan(0);
    for (const tab of await tabs.all()) await expect(tab).toHaveCSS('font-size', expected.text);
  });
}

test('all legacy body sizes normalize; font scaling works and header/icons/charts/reports stay excluded', async ({ page }) => {
  const legacy = ['7', '7.2', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '14', '14.5', '15', '16'];
  await page.evaluate(values => {
    const fixture = document.createElement('div');
    fixture.id = 'type-fixture';
    fixture.innerHTML = values.map(n => `<span class="type-body text-[${n}px]">فرایند Process</span>`).join('')
      + '<button class="type-body text-xs">Action</button><label class="type-body text-sm">Field</label><p class="type-body text-base">Description</p>'
      + '<h3>Section title</h3><div class="grid place-items-center text-[15px]">◈</div>'
      + '<svg><text font-size="9">axis</text></svg>'
      + '<div class="bg-white text-black"><p class="text-[10px]">Print preview</p></div>';
    document.querySelector('.app-main > section')!.append(fixture);
  }, legacy);
  for (const rootSize of [15, 16.5, 17.5]) {
    await page.locator('html').evaluate((el, value) => { (el as HTMLElement).style.fontSize = `${value}px`; }, rootSize);
    const expected = await sizes(page);
    for (const node of await page.locator('#type-fixture .type-body').all()) {
      await expect(node).toHaveCSS('font-size', expected.text);
    }
    await expect(page.locator('#type-fixture h3')).toHaveCSS('font-size', expected.title);
    await expect(page.locator('#type-fixture .place-items-center')).toHaveCSS('font-size', '15px');
    await expect(page.locator('#type-fixture svg text')).toHaveCSS('font-size', '9px');
    await expect(page.locator('#type-fixture .bg-white p')).toHaveCSS('font-size', '10px');
    await expect(page.locator('.app-header h1')).toHaveCSS('font-size', '15px');
    await expect(page.locator('[data-source-id="p6"] .tx1')).toHaveCSS('font-size', '11px');
  }
});
