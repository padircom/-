import { test, expect, type Page } from '@playwright/test';

async function openContractDomain(page: Page) {
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  const right = page.locator('.context-sidebar');
  await right.getByPlaceholder('Search domains / processes…').fill('Contract & Payment');
  await right.getByRole('button').filter({ has: page.locator('h3', { hasText: 'Contract & Payment Management' }) }).click();
  await page.getByRole('button', { name: /Enter domain page/ }).click();
  await expect(page.locator('.workspace-columns > aside')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  const indices: Record<string, unknown>[] = [];
  await page.route('**/api/cnt/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let data: Record<string, unknown> = {};
    let status = 200;
    if (path === '/api/cnt/contracts') data = { contracts: [{ id: 'ui-contract', code: 'UI-1', titleFa: 'پیمان آزمون' }] };
    else if (path === '/api/cnt/contracts/ui-contract') data = { contract: { Id: 'ui-contract' }, items: [{ Id: 'boq-1', ItemNo: '03-01', TitleFa: 'بتن‌ریزی', PricingBasis: 'unit_price', ChapterCode: '03', Unit: 'مترمکعب' }] };
    else if (path === '/api/cnt/ipc') data = { items: [{ id: 'ui-ipc', serialNo: 1, periodCode: '1405-01', workflowState: 'draft', workflowStateFa: 'پیش‌نویس', grossCurrent: 1000000, netPayable: 1000000, locked: false }] };
    else if (path === '/api/cnt/index' && request.method() === 'GET') data = { items: indices };
    else if (path === '/api/cnt/index' && request.method() === 'POST') {
      const body = request.postDataJSON();
      indices.push({ Id: `${body.indexPeriod}-${body.chapterCode}`, IndexPeriod: body.indexPeriod, ChapterCode: body.chapterCode, IndexValue: body.indexValue, Status: body.status, SourceFa: body.sourceFa, statusFa: body.status === 'published' ? 'Published' : 'Draft' });
      data = { action: 'created', ...body };
    } else if (path === '/api/cnt/ipc/ui-ipc/adjustment') {
      const body = request.postDataJSON();
      if (!body.dryRun) status = 201;
      data = body.dryRun
        ? { ipcId: 'ui-ipc', usable: true, rows: [{ chapterCode: '03', workAmount: 1000000, adjustmentFactor: 1.2, adjustmentAmount: 200000 }], blocked: [], totalAdjustment: 200000 }
        : { ipcId: 'ui-ipc', saved: [{ chapterCode: '03', adjustmentAmount: 200000 }], skipped: 0, totalAdjustment: 200000, subtotal: 1200000, netPayable: 1200000 };
    } else if (path === '/api/cnt/material-diff' && request.method() === 'POST') {
      status = 201;
      const body = request.postDataJSON();
      data = { id: 'diff-1', materialCode: body.materialCode, diffAmount: Number(body.quantity) * (Number(body.periodRate) - Number(body.baseRate)), direction: 'up' };
    }
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  await page.goto('/');
  await expect(page.locator('.context-sidebar')).toBeVisible();
});

test('d14-p4 index adjustment has preview-before-record workflow', async ({ page }) => {
  await openContractDomain(page);
  await page.locator('.workspace-columns > aside').getByRole('button', { name: /Index-Based Price Adjustment/ }).first().click();
  const panel = page.getByTestId('cnt-adjustment-workspace');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('cnt-adjustment-preview')).toBeDisabled();
  await expect(panel.getByTestId('cnt-adjustment-apply')).toBeDisabled();

  await panel.getByTestId('cnt-adjustment-index-period').fill('1405-Q1');
  await panel.getByTestId('cnt-adjustment-index-chapter').fill('03');
  await panel.getByTestId('cnt-adjustment-index-value').fill('120');
  await panel.getByTestId('cnt-adjustment-index-source').fill('بخشنامه ۱۴۰۵');
  await panel.getByTestId('cnt-adjustment-index-publish').click();
  await expect(panel.getByText('03', { exact: true })).toBeVisible();

  await panel.getByTestId('cnt-adjustment-period').fill('1405-Q1');
  await panel.getByTestId('cnt-adjustment-base-period').fill('1404-Q4');
  await panel.getByTestId('cnt-adjustment-applied-rate').fill('85');
  await panel.getByTestId('cnt-adjustment-preview').click();
  await expect(panel.getByTestId('cnt-adjustment-preview-result')).toContainText('03');
  await expect(panel.getByTestId('cnt-adjustment-apply')).toBeEnabled();
  await panel.getByTestId('cnt-adjustment-apply').click();
  await expect(panel.getByText(/Adjustment posted: 200,000/)).toBeVisible();
});

test('d14-p4 material differential previews amount and records against the chosen IPC', async ({ page }) => {
  await openContractDomain(page);
  await page.locator('.workspace-columns > aside').getByRole('button', { name: /Material Price Differential/ }).first().click();
  const panel = page.getByTestId('cnt-adjustment-workspace');
  await expect(panel).toBeVisible();
  await panel.getByTestId('cnt-material-code').fill('STEEL-A3');
  await panel.getByTestId('cnt-material-name').fill('میلگرد');
  await panel.getByTestId('cnt-material-quantity').fill('12');
  await panel.getByTestId('cnt-material-unit').fill('تن');
  await panel.getByTestId('cnt-material-base-rate').fill('300');
  await panel.getByTestId('cnt-material-period-rate').fill('380');
  await panel.getByTestId('cnt-material-evidence').fill('INV-1');
  await expect(panel.getByTestId('cnt-material-diff-estimate')).toContainText('960');
  await panel.getByTestId('cnt-material-diff-submit').click();
  await expect(panel.getByText(/Differential recorded: 960/)).toBeVisible();
  await expect(panel.getByTestId('cnt-material-diff-ledger')).toContainText('STEEL-A3');
  await expect(panel.getByTestId('cnt-material-diff-ledger')).toContainText('INV-1');
});
