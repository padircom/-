import { test, expect, type Locator, type Page } from '@playwright/test';

const sources = (page: Page) => page.locator('.sources-sidebar');
const context = (page: Page) => page.locator('.context-sidebar');
const toggle = (dock: Locator) => dock.locator(':scope > .sidebar-toggle');
async function appearance(button: Locator) {
  return button.evaluate(el => {
    const s = getComputedStyle(el);
    const svg = el.querySelector('svg')!;
    return {
      width: s.width, height: s.height, border: s.border, radius: s.borderRadius,
      color: s.color, background: s.backgroundColor, shadow: s.boxShadow,
      svg: svg.innerHTML, iconWidth: getComputedStyle(svg).width,
    };
  });
}
async function noOverlap(page: Page) {
  const workspace = (await page.locator('.app-main > section').boundingBox())!;
  const left = (await toggle(sources(page)).boundingBox())!;
  const right = (await context(page).boundingBox())!;
  expect(left.x + left.width).toBeLessThanOrEqual(workspace.x);
  expect(right.x).toBeGreaterThanOrEqual(workspace.x + workspace.width);
  expect(left.x + left.width).toBeLessThan(right.x);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/');
  await expect(toggle(sources(page))).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('all source rows and icons are flat, with selection and health preserved', async ({ page }) => {
  const rows = sources(page).locator('.source-row');
  await expect(rows).toHaveCount(8);
  for (const item of await rows.all()) {
    await expect(item).toHaveCSS('border-width', '0px');
    await expect(item).toHaveCSS('border-radius', '0px');
    await expect(item).toHaveCSS('box-shadow', 'none');
    await expect(item.locator(':scope > div > span')).toHaveCSS('border-width', '0px');
    await expect(item.locator(':scope > div > span')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  const target = sources(page).locator('[data-source-id="msp"]');
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect(target).toHaveAttribute('data-health', 'disconnected');
  await expect(page.locator('#source-health-detail')).toContainText('ورود فایل');
  await toggle(sources(page)).click();
  await expect(target).toBeHidden();
  await toggle(sources(page)).click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect(target).toHaveAttribute('data-health', 'disconnected');
  await expect(page.locator('#source-health-detail')).toContainText('ورود فایل');
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'false');
});

for (const lang of ['fa', 'en']) {
  for (const theme of ['dark', 'light']) {
    test(`right sidebar has no hide control; left control is unchanged: ${lang}, ${theme}, expanded and collapsed`, async ({ page }) => {
      await page.locator('.app-header').getByRole('button', { name: lang === 'fa' ? 'فارسی' : 'EN', exact: true }).click();
      await page.getByRole('button', { name: theme === 'dark' ? 'Dark theme' : 'Light theme', exact: true }).click();
      const left = toggle(sources(page));
      await expect(toggle(context(page))).toHaveCount(0);
      const right = context(page);
      const beforeLeft = (await left.boundingBox())!;
      const beforeRight = (await right.boundingBox())!;
      const base = await appearance(left);
      await expect(right).toHaveCSS('width', '320px');
      await noOverlap(page);
      for (const dock of [sources(page), sources(page)]) {
        await toggle(dock).click();
        await expect(toggle(dock)).toBeFocused();
        await page.mouse.move(700, 20); // compare resting appearances, not hover vs rest
        expect(await appearance(left)).toEqual(base);
        await expect(right).toHaveCSS('width', '320px');
        expect(await left.boundingBox()).toEqual(beforeLeft);
        expect(await right.boundingBox()).toEqual(beforeRight);
        await noOverlap(page);
        const controls = await toggle(dock).getAttribute('aria-controls');
        const panel = page.locator(`[id="${controls}"]`);
        const closed = (await toggle(dock).getAttribute('aria-expanded')) === 'false';
        expect(await panel.evaluate(el => (el as HTMLElement).inert)).toBe(closed);
        if (closed) await expect(panel).toBeHidden();
        else await expect(panel).toBeVisible();
      }
    });
  }
}

test('right sidebar remains visible and searchable while only the left collapses', async ({ page }) => {
  const search = context(page).locator('input');
  await search.fill('P6');
  await toggle(sources(page)).click();
  await expect(sources(page)).toHaveCSS('width', '40px');
  await expect(context(page)).toHaveCSS('width', '320px');
  await expect(toggle(context(page))).toHaveCount(0);
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  await expect(search).toHaveValue('P6');
  await expect(toggle(sources(page))).toHaveAttribute('aria-expanded', 'false');
  await expect(context(page)).toHaveCSS('width', '320px');
  await toggle(sources(page)).click();
  await expect(sources(page)).toHaveCSS('width', '248px');
  await noOverlap(page);
});

for (const width of [1024, 390]) {
  test(`controls occupy separate layout rails at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const dock of [sources(page), sources(page)]) {
      await toggle(dock).click();
      await noOverlap(page);
      const rect = (await toggle(dock).boundingBox())!;
      const rail = (await dock.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(rail.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(rail.x + rail.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
