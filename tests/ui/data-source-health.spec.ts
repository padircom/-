import { test, expect, type Page } from '@playwright/test';

const endpoint = '**/api/integrations/status';
const at = new Date('2026-09-29T10:00:00Z');
const connected = (id = 'p6') => ({ id, configured: true, mode: 'api', connected: true, checkedAt: at.toISOString(), latencyMs: 23 });
const row = (page: Page, id: string) => page.locator(`[data-source-id="${id}"]`);
async function english(page: Page) {
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
}
async function boot(page: Page) {
  await page.goto('/');
  await english(page);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: at });
  await page.route('https://api.open-meteo.com/**', route => route.abort());
});

test('configuration-only API never produces green, fake latency or a fixed connection count', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: [
    { id: 'p6', configured: false, mode: 'file-import' },
    { id: 'msp', configured: true, mode: 'file-import' },
    { id: 'sap', configured: false, mode: 'rest-odata' },
    { id: 'powerbi', configured: true, mode: 'embedded' },
  ], meta: { timestamp: at.toISOString() } } }));
  await boot(page);
  await expect(row(page, 'msp')).toHaveAttribute('data-health', 'disconnected');
  await expect(row(page, 'sap')).toHaveAttribute('data-health', 'disconnected');
  await expect(row(page, 'pbi')).toHaveAttribute('data-health', 'unknown');
  await expect(row(page, 'das')).toHaveAttribute('data-health', 'unknown');
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
  await expect(page.locator('.sources-sidebar header p')).toHaveText('0 of 8 connections verified');
  await expect(row(page, 'p6')).not.toContainText('12ms');
  await expect(row(page, 'msp')).toHaveAttribute('title', /file import.*not a live connection/);
  await row(page, 'msp').click();
  await expect(page.locator('#source-health-detail')).toContainText('not a live connection');
  await row(page, 'das').click();
  await expect(page.locator('#source-health-detail')).toContainText('did not report this source');
  await page.locator('.app-header').getByRole('button', { name: 'فارسی', exact: true }).click();
  await expect(row(page, 'das')).toContainText('نامشخص');
  await expect(page.locator('#source-health-detail')).toContainText('API برای این منبع');
});

test('fresh explicit health, Power BI alias, failure, and automatic recovery', async ({ page }) => {
  let online = true;
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: online
    ? [connected(), connected('powerbi')]
    : [{ id: 'p6', connected: false }, { id: 'powerbi', configured: false }] } }));
  await boot(page);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
  await expect(row(page, 'p6')).toContainText('23 ms');
  await expect(row(page, 'pbi')).toHaveAttribute('data-health', 'connected');
  await expect(page.locator('.sources-sidebar header p')).toHaveText('2 of 8 connections verified');
  online = false;
  await page.clock.runFor(30_100);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'disconnected');
  await expect(row(page, 'p6')).not.toContainText('23 ms');
  await row(page, 'p6').click(); // selected by default; deselect then reselect
  await row(page, 'p6').click();
  await expect(page.locator('#source-health-detail')).toContainText('reports a disconnected source');
  online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
});

for (const status of [401, 403, 503]) {
  test(`HTTP ${status} clears previous green status without leaking error internals`, async ({ page }) => {
    let failed = false;
    await page.route(endpoint, route => route.fulfill(failed
      ? { status, json: { ok: false, error: { message: 'private-server-config' } } }
      : { json: { ok: true, data: [connected()] } }));
    await boot(page);
    await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
    failed = true;
    await page.clock.runFor(30_100);
    await expect(row(page, 'p6')).toHaveAttribute('data-health', 'unknown');
    await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
    await expect(page.locator('.sources-sidebar')).not.toContainText('private-server-config');
  });
}

test('browser offline invalidates green immediately and online rechecks', async ({ page, context }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: [connected()] } }));
  await boot(page);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
  await context.setOffline(true);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'unknown');
  await expect(row(page, 'p6')).toHaveAttribute('title', /browser is offline/);
  await context.setOffline(false);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
});

test('repeated responses with old evidence cannot keep a connection green', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: [connected()] } }));
  await boot(page);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
  await page.clock.runFor(61_100);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'unknown');
  await expect(row(page, 'p6')).toHaveAttribute('title', /stale/);
});

test('loading and request timeout stay neutral; later refresh recovers', async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  let hold = true;
  await page.route(endpoint, async route => {
    if (hold) await pending;
    await route.fulfill({ json: { ok: true, data: [connected()] } }).catch(() => {});
  });
  await boot(page);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'loading');
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
  await page.clock.runFor(8_100);
  await expect(row(page, 'p6')).toHaveAttribute('title', /timed out/);
  hold = false;
  finish();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
});

test('HTML/non-JSON and network errors are not interpreted as connectivity', async ({ page }) => {
  let mode: 'html' | 'network' = 'html';
  await page.route(endpoint, route => mode === 'html'
    ? route.fulfill({ contentType: 'text/html', body: '<html>Fallback page</html>' })
    : route.abort('failed'));
  await boot(page);
  await expect(row(page, 'p6')).toHaveAttribute('title', /response is invalid/);
  mode = 'network';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row(page, 'p6')).toHaveAttribute('title', /service is unreachable/);
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
});

test('user changes and logout discard the previous session status', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data:
    route.request().headers()['x-user-id'] === 'u-admin' ? [connected()] : [{ id: 'p6', configured: false }] } }));
  await boot(page);
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'connected');
  await page.locator('.auth-status > button').click();
  await page.locator('.auth-status select').selectOption('u-pm');
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'disconnected');
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(row(page, 'p6')).toHaveAttribute('data-health', 'unknown');
  await expect(row(page, 'p6')).toHaveAttribute('title', /Sign in to view/);
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
});
