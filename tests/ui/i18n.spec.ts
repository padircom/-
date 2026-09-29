import { test, expect, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();

async function locale(page: Page, lang: 'fa' | 'en') {
  await page.locator('.app-header').getByRole('button', { name: lang === 'fa' ? 'فارسی' : 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.locator('html')).toHaveAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
  await page.evaluate(() => document.fonts.ready);
}

async function dimensions(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      header: box('.app-header'), sources: box('.sources-sidebar'),
      nav: box('.context-sidebar'), workspace: box('.app-main > section'),
      sourceCard: box('.sources-sidebar .source-row'),
      langButton: box('.header-controls > .toggle-shell button'),
      clock: box('.wchip:last-child'),
    };
  });
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  // Optional external weather is irrelevant to this presentation regression.
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.context-sidebar')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'uncaught browser errors').toEqual([]);
});

for (const width of [1440, 1024, 390]) {
  test(`FA → EN → FA: stable line boxes, controls and panels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await locale(page, 'fa');
    const fa = await dimensions(page);
    await expect(page.locator('body')).toHaveCSS('font-family', /^Vazirmatn,/);
    await locale(page, 'en');
    const en = await dimensions(page);
    await expect(page.locator('body')).toHaveCSS('font-family', /^Inter,/);
    for (const key of Object.keys(fa) as (keyof typeof fa)[]) {
      expect(Math.abs(en[key].height - fa[key].height), `${key} height`).toBeLessThanOrEqual(1);
      // Panel widths are stable; the restored header uses natural widget sizing.
      if (key !== 'langButton' && key !== 'clock') expect(Math.abs(en[key].width - fa[key].width), `${key} width`).toBeLessThanOrEqual(1);
    }
    expect(fa.nav.x).toBeGreaterThan(fa.workspace.x);
    expect(en.nav.x).toBeGreaterThan(en.workspace.x);
    expect(fa.sources.x).toBeLessThan(fa.workspace.x);
    expect(en.sources.x).toBeLessThan(en.workspace.x);
    for (const key of ['sources', 'workspace', 'nav'] as const) {
      expect(en[key].x, `${key} must not move when switching language`).toBe(fa[key].x);
    }
    await expect(page.locator('.context-sidebar aside')).toHaveCSS('direction', 'ltr');
    await expect(page.getByRole('button', { name: 'فارسی', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) {
      // Native logical scrolling reaches both ends, not an inaccessible reverse-flex overflow.
      await page.locator('.app-main').evaluate(e => { e.scrollLeft = e.scrollWidth; });
      await expect(page.locator('.context-sidebar')).toBeInViewport();
      await page.locator('.app-main').evaluate(e => { e.scrollLeft = 0; });
      await expect(page.locator('.sources-sidebar')).toBeInViewport();
    }
    await locale(page, 'fa');
    const again = await dimensions(page);
    expect(again.header.height).toBe(fa.header.height);
    expect(again.sourceCard.height).toBe(fa.sourceCard.height);
    await expect(page.locator('main')).toHaveCSS('direction', 'ltr');
    await expect(page.locator('.context-sidebar aside')).toHaveCSS('direction', 'rtl');
    await expect(page.locator('.app-main > section')).toHaveCSS('direction', 'rtl');
    expect(await page.evaluate(() => document.fonts.check('200 12px Vazirmatn', 'فارسی'))).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('300 12px Inter', 'English'))).toBe(true);
  });
}

test('fixed left sidebar collapse/expand; theme does not reset locale', async ({ page }) => {
  for (const lang of ['en', 'fa'] as const) {
    await locale(page, lang);
    const hide = page.getByRole('button', { name: lang === 'fa' ? 'پنهان کردن سایدبار منابع داده' : 'Hide data sources sidebar' });
    await expect(hide.locator('svg')).toHaveCSS('rotate', 'none');
    await hide.click();
    const show = page.getByRole('button', { name: lang === 'fa' ? 'نمایش سایدبار منابع داده' : 'Show data sources sidebar' });
    await expect(show).toBeInViewport();
    await expect(show.locator('svg')).toHaveCSS('rotate', 'none');
    const handleX = (await show.boundingBox())!.x;
    await locale(page, lang === 'fa' ? 'en' : 'fa');
    expect((await page.locator('.sources-sidebar > button').boundingBox())!.x).toBe(handleX);
    await expect(page.locator('.sources-sidebar > button')).toBeInViewport();
    await locale(page, lang);
    await show.click();
    await expect(page.locator('.sources-sidebar')).toHaveCSS('width', '248px');
    await page.getByRole('button', { name: 'Light theme', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
  }
});

test('calendar navigation reflects locale, non-directional icons do not mirror', async ({ page }) => {
  await locale(page, 'en');
  await page.getByRole('button', { name: 'Calendar & Tasks', exact: true }).click();
  const previous = page.locator('main section header button').filter({ hasText: '<' }).locator('span');
  await expect(previous).toHaveCSS('rotate', 'none');
  await locale(page, 'fa');
  await expect(previous).toHaveCSS('rotate', '180deg');
  await expect(page.getByRole('button', { name: 'Light theme', exact: true }).locator('svg')).toHaveCSS('rotate', 'none');
});

test('real project grid: codes, actions, row heights and locale roundtrip', async ({ page }) => {
  await locale(page, 'en');
  await page.getByRole('button', { name: /System Administration & Base Config/ }).click();
  await page.getByRole('button', { name: /2\. Projects Master/ }).click();
  const table = page.locator('table');
  await expect(table).toBeVisible();
  const row = table.locator('tbody tr').first();
  const enHeight = (await row.boundingBox())!.height;
  const code = row.locator('td').first();
  await expect(code).toHaveText('OG-2401');
  await expect(code).toHaveCSS('direction', 'ltr');
  const x = async () => row.locator('td').evaluateAll(cells => cells.map(c => c.getBoundingClientRect().x));
  const enX = await x();
  expect(enX[0]).toBeLessThan(enX.at(-1)!);
  await locale(page, 'fa');
  const faX = await x();
  expect(faX[0]).toBeGreaterThan(faX.at(-1)!);
  expect(Math.abs((await row.boundingBox())!.height - enHeight)).toBeLessThanOrEqual(1);
  await expect(code).toHaveText('OG-2401');
  await expect(code).toHaveCSS('direction', 'ltr');
  const back = page.getByRole('button', { name: /بازگشت/ }).first();
  await expect(back.locator('span')).toHaveCSS('rotate', '0deg');
  await locale(page, 'en');
  await expect(page.getByRole('button', { name: /Back$/ }).locator('span')).toHaveCSS('rotate', '180deg');
  await page.setViewportSize({ width: 390, height: 900 });
  const scroll = table.locator('..');
  await expect(scroll).toHaveCSS('overflow-x', 'auto');
  expect(await scroll.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
  await scroll.evaluate(e => { e.scrollLeft = e.scrollWidth; });
  await expect(row.locator('td').last()).toBeInViewport();
  await locale(page, 'fa');
  await scroll.evaluate(e => { e.scrollLeft = -e.scrollWidth; });
  await expect(row.locator('td').last()).toBeInViewport();
});

test('inner workspace sidebar stays on the right without changing the active process', async ({ page }) => {
  await locale(page, 'en');
  await page.getByRole('button', { name: '🧭 Planning & Execution', exact: true }).click();
  await page.getByRole('button', { name: /Enter domain page/ }).click();
  const columns = page.locator('.workspace-columns');
  await expect(columns).toBeVisible();
  const nav = columns.locator(':scope > aside');
  const content = columns.locator(':scope > div');
  expect((await nav.boundingBox())!.x).toBeGreaterThan((await content.boundingBox())!.x);
  const navX = (await nav.boundingBox())!.x;
  const width = (await nav.boundingBox())!.width;
  await nav.getByRole('button', { name: 'Baseline Schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Interactive Gantt', exact: true }).click();
  await expect(page.locator('.timeline-axis').first()).toBeVisible();
  await locale(page, 'fa');
  await expect(nav.locator('.row-on')).toContainText('برنامه پایه');
  await expect(page.locator('.timeline-axis').first()).toHaveCSS('direction', 'ltr');
  const ticks = await page.locator('.timeline-axis').first().locator(':scope > div').evaluateAll(es => es.map(e => e.getBoundingClientRect().x));
  expect(ticks[0]).toBeLessThan(ticks[1]);
  expect((await nav.boundingBox())!.x).toBeGreaterThan((await content.boundingBox())!.x);
  expect((await nav.boundingBox())!.width).toBe(width);
  expect((await nav.boundingBox())!.x).toBe(navX);
  await expect(page.getByRole('button', { name: /بازگشت به داشبورد/ }).locator('span')).toHaveCSS('rotate', '0deg');
});

test('CSS table contract: mixed numbers, dates, identifiers and native horizontal scrolling', async ({ page }) => {
  // Isolated presentation fixture: never seeds or writes backend data.
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'grid-fixture';
    fixture.style.cssText = 'position:fixed;inset-block-start:160px;inset-inline-start:20px;z-index:100;width:420px;background:var(--bg-c)';
    fixture.innerHTML = `<div class="overflow-x-auto" style="overflow-x:auto">
      <table style="min-width:1000px;width:100%;font-size:12px"><thead><tr>
        <th>Code / کد</th><th>Description / شرح</th><th class="text-end">Amount / مبلغ</th><th>Date / تاریخ</th><th>Actions / عملیات</th>
      </tr></thead><tbody>
        <tr><td class="font-mono" dir="ltr">OG-2401/A</td><td>پروژه Alpha</td><td class="tabular-nums" dir="ltr">−1,234.50</td><td class="font-mono" dir="ltr">2026-09-29</td><td><button>Edit / ویرایش</button></td></tr>
        <tr><td class="font-mono" dir="ltr">CN-02</td><td>قرارداد Beta</td><td class="tabular-nums" dir="ltr">۱٬۲۳۴٫۵۰</td><td class="font-mono" dir="ltr">1405/07/07</td><td><button>View / مشاهده</button></td></tr>
      </tbody></table></div>`;
    document.body.append(fixture);
  });
  let height = 0;
  for (const lang of ['fa', 'en', 'fa'] as const) {
    await locale(page, lang);
    const fixture = page.locator('#grid-fixture');
    const table = fixture.locator('table');
    const row = table.locator('tbody tr').first();
    const rect = (await row.boundingBox())!;
    if (height) expect(rect.height).toBe(height);
    height = rect.height;
    const amount = row.locator('.tabular-nums');
    await expect(amount).toHaveCSS('direction', 'ltr');
    await expect(amount).toHaveCSS('unicode-bidi', 'isolate');
    await expect(amount).toHaveCSS('text-align', lang === 'fa' ? 'start' : 'end');
    await expect(amount).toHaveCSS('font-variant-numeric', 'lining-nums tabular-nums');
    await expect(amount).toHaveText('−1,234.50');
    await expect(row.locator('td').nth(3)).toHaveText('2026-09-29');
    const scroller = fixture.locator('.overflow-x-auto');
    const overflow = await scroller.evaluate(e => e.scrollWidth > e.clientWidth);
    expect(overflow).toBe(true);
    await scroller.evaluate((e, rtl) => { e.scrollLeft = rtl ? -e.scrollWidth : e.scrollWidth; }, lang === 'fa');
    expect(await scroller.evaluate(e => Math.abs(e.scrollLeft))).toBeGreaterThan(0);
    await expect(row.locator('button')).toBeInViewport();
    await scroller.evaluate(e => { e.scrollLeft = 0; });
    await expect(row.locator('td').first()).toBeInViewport();
  }
});
