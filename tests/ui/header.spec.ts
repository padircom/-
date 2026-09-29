import { test, expect } from '@playwright/test';

for (const theme of ['dark', 'light']) {
  test(`original main header stays left-controls / right-brand in both languages (${theme})`, async ({ page }) => {
    await page.route('https://api.open-meteo.com/**', route => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: theme === 'dark' ? 'Dark theme' : 'Light theme', exact: true }).click();
    const header = page.locator('.app-header');
    let leftEdge: number | undefined;
    let rightEdge: number | undefined;
    for (const lang of ['fa', 'en', 'fa']) {
      await header.getByRole('button', { name: lang === 'fa' ? 'فارسی' : 'EN', exact: true }).click();
      await page.evaluate(() => document.fonts.ready);
      await expect(header).toHaveAttribute('dir', 'ltr');
      await expect(header).toHaveCSS('direction', 'ltr');
      await expect(header).toHaveCSS('display', 'flex');
      await expect(header).toHaveCSS('font-family', /^Vazirmatn,/);
      const controls = (await header.locator('.header-controls').boundingBox())!;
      const brand = (await header.locator('.header-brand').boundingBox())!;
      expect(controls.x + controls.width).toBeLessThan(brand.x);
      const end = brand.x + brand.width;
      if (leftEdge !== undefined) expect(controls.x).toBe(leftEdge);
      if (rightEdge !== undefined) expect(end).toBe(rightEdge);
      leftEdge = controls.x;
      rightEdge = end;
      expect((await header.boundingBox())!.height).toBe(76);
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
      await expect(page.locator('.app-main > section')).toHaveCSS('direction', lang === 'fa' ? 'rtl' : 'ltr');
      await expect(page.locator('body')).toHaveCSS('font-family', lang === 'fa' ? /^Vazirmatn,/ : /^Inter,/);
      await expect(page.locator('.context-sidebar .sidebar-toggle')).toHaveCount(0);
      await expect(page.locator('.sources-sidebar .sidebar-toggle')).toBeVisible();
      const sources = (await page.locator('.sources-sidebar').boundingBox())!;
      const context = (await page.locator('.context-sidebar').boundingBox())!;
      expect(sources.x).toBeLessThan(context.x);
    }
  });
}
