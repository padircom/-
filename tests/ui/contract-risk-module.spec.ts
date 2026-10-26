import { test, expect, type Page } from '@playwright/test';

const riskWorkspace = {
  categories: [{ code: 'payment_cashflow', labelFa: 'پرداخت و جریان نقدی' }],
  risks: [], actions: [], obligations: [], improvements: [], findings: [],
  scoringRules: [], assessments: [],
  contracts: [{ Id: 'risk-link-contract', Code: 'RISK-01', TitleFa: 'پیمان پیوند ریسک' }],
  amendments: [], trend: [],
  summary: {
    totalRisks: 0, critical: 0, high: 0, medium: 0, low: 0, unassessed: 0,
    ownerless: 0, inadequateControl: 0, residualCritical: 0, overdueActions: 0,
    overdueObligations: 0, improvementsPendingApproval: 0, clausesNeedingReview: 0,
    linkedActiveClaims: 0, matrix: {}, criticalList: [],
  },
  today: '2026-10-26', defaultScoringConfig: {},
  scoringRule: { approved: true, isDefault: true, version: '1.0', approvedBy: null, approvedAt: null },
  links: { delayEvents: [], claims: [] },
};

async function installMocks(page: Page) {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.route('**/api/cnt-risk/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, data: riskWorkspace }),
  }));
  await page.route('**/api/cnt/contracts**', (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/risk-link-contract')
      ? { contract: { Id: 'risk-link-contract', Code: 'RISK-01', TitleFa: 'پیمان پیوند ریسک' }, items: [] }
      : { contracts: [{ id: 'risk-link-contract', code: 'RISK-01', titleFa: 'پیمان پیوند ریسک' }] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: body }) });
  });
  await page.goto('/');
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
}

async function enterDomain(page: Page, search: string, title: string) {
  const right = page.locator('.context-sidebar');
  await right.getByPlaceholder('Search domains / processes…').fill(search);
  await right.getByRole('button').filter({ has: page.locator('h3', { hasText: title }) }).click();
  await right.getByRole('button', { name: /Enter domain page/ }).click();
  await expect(page.locator('.workspace-columns > aside')).toBeVisible();
}

test('contract risk is a peer module and its contract list opens the linked contract register', async ({ page }) => {
  await installMocks(page);
  await enterDomain(page, 'Contract Risk Management', 'Contract Risk Management');
  await expect(page.getByRole('heading', { name: 'Contract Risk & Improvement' })).toBeVisible();
  await expect(page.locator('.workspace-columns > aside').getByRole('button', { name: /Contract Risk, Obligations & Actions Register/ })).toBeVisible();
  await page.getByRole('button', { name: 'دفتر ثبت ریسک‌های قراردادی' }).click();
  const contractLink = page.getByTestId('contract-risk-contract-select');
  await contractLink.selectOption('RISK-01');
  await expect(contractLink).toHaveValue('RISK-01');

  await page.getByRole('button', { name: 'مدیریت قراردادها و نسخه‌ها' }).click();
  await expect(page.getByText('RISK-01 · پیمان پیوند ریسک')).toBeVisible();
  await page.getByRole('button', { name: 'Open contract register' }).click();
  await expect(page.getByText('Contract & Payment Management')).toBeVisible();
  await expect(page.locator('#contract-section-selector')).toHaveValue('risk-link-contract');
});

test('contract-management risk shortcut routes to the standalone peer module', async ({ page }) => {
  await installMocks(page);
  await enterDomain(page, 'Contract & Payment', 'Contract & Payment Management');
  await page.locator('.workspace-columns > aside').getByRole('button', { name: /Contract Risk \(open standalone module\)/ }).click();
  await expect(page.getByText('Contract Risk Management').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contract Risk & Improvement' })).toBeVisible();
});
