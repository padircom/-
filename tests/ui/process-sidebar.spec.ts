import { test, expect, type Locator } from '@playwright/test';

async function expectFlat(nodes: Locator, transparent = true) {
  expect(await nodes.count()).toBeGreaterThan(0);
  const styles = await nodes.evaluateAll((elements, transparent) => elements.map(el => {
    const css = getComputedStyle(el);
    return [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth,
      css.borderRadius, css.boxShadow, ...(transparent ? [css.backgroundColor] : [])];
  }), transparent);
  for (const style of styles) {
    expect(style).toEqual(['0px', '0px', '0px', '0px', '0px', 'none', ...(transparent ? ['rgba(0, 0, 0, 0)'] : [])]);
  }
}

for (const domain of [
  'Planning & Execution',
  'Project Information & Document Management',
  'Quality & Inspection Management',
  'Risk, Change & Claims',
]) {
  test(`process navigation is flat and still selectable: ${domain}`, async ({ page }) => {
    await page.route('https://api.open-meteo.com/**', route => route.abort());
    await page.goto('/');
    const header = page.locator('.app-header');
    await header.getByRole('button', { name: 'EN', exact: true }).click();
    const right = page.locator('.context-sidebar');
    await right.getByPlaceholder('Search domains / processes…').fill(domain);
    const domainButton = right.getByRole('button').filter({ has: page.locator('h3', { hasText: domain }) });
    await domainButton.click();
    const list = right.locator('.fade-rise > .rounded-xl.border[class~="bg-black/10"]');
    await expectFlat(list);
    // The domain-entry form and native controls are not process cards.
    await expect(right.locator('.fade-rise > .glass')).toHaveCSS('border-top-width', '1px');
    await domainButton.click();
    await expect(list).toHaveCount(0);
    await domainButton.click();
    await expectFlat(list);
    await expect(page.locator('.sources-sidebar .sidebar-toggle')).toBeVisible();
    await right.getByRole('button', { name: /Enter domain page/ }).click();
    const nav = page.locator('.workspace-columns > aside');
    await expect(nav).toBeVisible();
    const groups = nav.locator(':scope > .thin-scroll > .rounded-xl');
    const rows = nav.locator('button.glass-row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(1);
    for (const lang of ['fa', 'en']) {
      await header.getByRole('button', { name: lang === 'fa' ? 'فارسی' : 'EN', exact: true }).click();
      for (const theme of ['Light theme', 'Dark theme']) {
        await header.getByRole('button', { name: theme, exact: true }).click();
        await page.mouse.move(0, 0);
        await expectFlat(groups);
        await expectFlat(rows, false);
        await expectFlat(nav.locator('button.glass-row:not(.row-on)'));
        await expect(nav).toHaveCSS('width', '300px');
        await expect(nav).toHaveCSS('border-top-width', '1px');
      }
    }
    const target = rows.nth(1);
    await target.click();
    await expect(target).toHaveClass(/row-on/);
    await page.mouse.move(0, 0);
    await expect(target).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await target.focus();
    await expect(target).toBeFocused();
    const unselected = nav.locator('button.glass-row:not(.row-on)').first();
    await unselected.hover();
    await expect(unselected).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(unselected).toHaveCSS('translate', 'none');
    await expect(unselected).toHaveCSS('transform', 'none');
    await expect(rows).toHaveCount(rowCount);
    await expect(page.locator('.context-sidebar .sidebar-toggle')).toHaveCount(0);
  });
}
