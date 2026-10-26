import { test, expect } from '@playwright/test';

test('contract risk sections live under its peer sidebar group, with process map separate', async ({ page }) => {
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
  await expect(domainNav.getByRole('button', { name: 'Contract Management', exact: true })).toBeVisible();
  const riskSection = domainNav.getByRole('button', { name: 'Contract Risk Management', exact: true });
  await expect(riskSection).toBeVisible();
  await expect(riskSection).toHaveAttribute('aria-expanded', 'false');
  await expect(domainNav.getByRole('button', { name: 'Payment Certificate Management', exact: true })).toBeVisible();
  await expect(domainNav.getByRole('button', { name: 'Risk control center', exact: true })).toBeHidden();
  await riskSection.click();
  await expect(riskSection).toHaveAttribute('aria-expanded', 'true');
  const riskSubsections = [
    'Risk control center', 'Contracts & versions', 'Contract clause analysis', 'Contract risk register',
    'Assessment & ranking matrix', 'Contract obligations & deadlines', 'Contract improvement proposals',
    'Risk response plan', 'Control effectiveness', 'Claims, delay & loss links', 'Reports & management outputs',
    'Scoring rules & settings',
  ];
  for (const label of riskSubsections) {
    const subsection = domainNav.getByRole('button', { name: label, exact: true });
    await expect(subsection).toBeVisible();
    await subsection.click();
    await expect(riskSection).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.getByRole('heading', { name: 'Contract Risk Management' })).toBeVisible();
  const processMap = page.getByRole('button', { name: /Process map/ });
  await expect(processMap).toHaveAttribute('aria-pressed', 'false');
  await processMap.click();
  await expect(processMap).toHaveAttribute('aria-pressed', 'true');
});
