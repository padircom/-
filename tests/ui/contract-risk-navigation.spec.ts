import { test, expect } from '@playwright/test';

test('contract risk is a peer process beside contract register and IPC inside d14', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.route('**/api/cnt-risk/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, data: {
      categories: [], risks: [], actions: [], obligations: [], improvements: [], findings: [],
      scoringRules: [], assessments: [], contracts: [], amendments: [], trend: [],
      summary: { matrix: {}, criticalList: [] }, today: '2026-10-26',
      defaultScoringConfig: { impactWeights: {}, bands: {} },
      scoringRule: { approved: false, isDefault: true, version: '1.0', approvedBy: null, approvedAt: null },
      links: { delayEvents: [], claims: [] },
    } }),
  }));
  await page.goto('/');
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  const right = page.locator('.context-sidebar');
  await right.getByPlaceholder('Search domains / processes…').fill('Contract & Payment');
  await right.getByRole('button').filter({ has: page.locator('h3', { hasText: 'Contract & Payment Management' }) }).click();
  await right.getByRole('button', { name: /Enter domain page/ }).click();

  const domainNav = page.locator('.workspace-columns > aside');
  await expect(domainNav.getByText(/Contract Register & BOQ/)).toBeVisible();
  await expect(domainNav.getByText(/Measurement & Interim Payment/)).toBeVisible();
  await expect(domainNav.getByText(/Contract Risk Management/)).toBeVisible();
  await domainNav.getByRole('button', { name: /Contract Risk & Improvement/ }).click();
  await expect(page.getByRole('heading', { name: 'Contract Risk & Improvement' })).toBeVisible();
});
