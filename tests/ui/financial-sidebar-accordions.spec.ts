import { test, expect } from '@playwright/test';

test('cost, procurement, and logistics groups expand as accordions in financial monitoring', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.goto('/');
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();

  const right = page.locator('.context-sidebar');
  await right.getByPlaceholder('Search domains / processes…').fill('Cost, Supply & Logistics');
  await right.getByRole('button').filter({ has: page.locator('h3', { hasText: 'Cost, Supply & Logistics' }) }).click();
  await right.getByRole('button', { name: /Enter domain page/ }).click();

  await expect(page.getByRole('heading', { name: 'Cost, Supply & Logistics', exact: true })).toHaveCount(0);
  const domainNav = page.locator('.workspace-columns > aside');
  const cost = domainNav.getByRole('button', { name: 'Cost Management', exact: true });
  const procurement = domainNav.getByRole('button', { name: 'Procurement Management', exact: true });
  const logistics = domainNav.getByRole('button', { name: 'Logistics Management', exact: true });

  await expect(cost).toHaveAttribute('aria-expanded', 'true');
  await expect(procurement).toHaveAttribute('aria-expanded', 'false');
  await expect(logistics).toHaveAttribute('aria-expanded', 'false');
  await expect(domainNav.getByRole('button', { name: 'Budget Control', exact: true })).toBeVisible();
  await expect(domainNav.getByRole('button', { name: 'PR Management', exact: true })).toBeHidden();

  await procurement.click();
  await expect(procurement).toHaveAttribute('aria-expanded', 'true');
  await expect(cost).toHaveAttribute('aria-expanded', 'false');
  await expect(domainNav.getByRole('button', { name: 'PR Management', exact: true })).toBeVisible();

  await logistics.click();
  await expect(logistics).toHaveAttribute('aria-expanded', 'true');
  await expect(procurement).toHaveAttribute('aria-expanded', 'false');
  await expect(domainNav.getByRole('button', { name: 'Inventory Control', exact: true })).toBeVisible();
});
