import { test, expect, type Page } from '@playwright/test';

/**
 * قرارداد «سلامت اتصال» پس از حذف پنل منابع داده.
 *
 * نشانگر وضعیت اکنون سرِ جای واقعی خودش است؛ این spec آن را روی صفحهٔ
 * «داشبوردها و گزارشات» (دکمهٔ Power BI) می‌سنجد، چون همان قرارداد با همان
 * hook روی سه سطح کاری رندر می‌شود. قواعد ثابت:
 *  - پیکربندی‌شده، حالت ورود فایل و پاسخ قدیمی هرگز «سبز» نمی‌شوند.
 *  - خطای HTTP، مرورگر آفلاین، مهلت تمام‌شده و پاسخ نامعتبر وضعیت را پاک می‌کنند.
 *  - هیچ پیام داخلی سرور در HTML نمی‌ماند.
 */

const endpoint = '**/api/integrations/status';
const at = new Date('2026-09-29T10:00:00Z');
const connected = (id = 'pbi') => ({ id, configured: true, mode: 'embedded', connected: true, checkedAt: at.toISOString(), latencyMs: 23 });
const chip = (page: Page) => page.locator('[data-connector="pbi"]');

async function reports(page: Page) {
  await page.locator('.app-header').getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(chip(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: at });
  await page.route('https://api.open-meteo.com/**', route => route.abort());
  await page.goto('/');
});

test('configuration-only API never produces green, fake latency or an invented source', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: [
    { id: 'p6', configured: false, mode: 'file-import' },
    { id: 'msp', configured: true, mode: 'file-import' },
    { id: 'sap', configured: false, mode: 'rest-odata' },
    { id: 'powerbi', configured: true, mode: 'embedded' },
  ], meta: { timestamp: at.toISOString() } } }));
  await reports(page);
  await expect(chip(page)).toHaveAttribute('data-health', 'unknown');
  await expect(chip(page)).toHaveAttribute('title', /not verified a live connection/);
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
  await expect(chip(page)).not.toContainText('23');
  await page.locator('.app-header').getByRole('button', { name: 'فارسی', exact: true }).click();
  await expect(chip(page)).toContainText('نامشخص');
  await expect(chip(page)).toHaveAttribute('title', /اتصال زندهٔ ارتباط را تأیید نکرده/);
});

test('fresh explicit health turns green, failure clears it, and focus recovers it', async ({ page }) => {
  let online = true;
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: online
    ? [connected('powerbi')]
    : [{ id: 'powerbi', configured: true, connected: false }] } }));
  await reports(page);
  await expect(chip(page)).toHaveAttribute('data-health', 'connected');
  await expect(chip(page)).toHaveAttribute('title', /confirmed this connection/);
  online = false;
  await page.clock.runFor(30_100);
  await expect(chip(page)).toHaveAttribute('data-health', 'disconnected');
  online = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(chip(page)).toHaveAttribute('data-health', 'connected');
});

test('the Power BI export never claims a live push beyond the confirmed status', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: [{ id: 'powerbi', configured: true, mode: 'embedded' }] } }));
  await reports(page);
  const action = page.locator('[data-connector-actions="powerbi"]');
  await action.getByRole('button', { name: /Power BI/ }).click();
  const note = action.locator('[role="status"]');
  await expect(note).toBeVisible();
  await expect(note).toContainText(/Export created|needs the data/);
  await expect(note).not.toContainText(/published|refreshed/i);
});

for (const status of [401, 403, 503]) {
  test(`HTTP ${status} clears previous green status without leaking error internals`, async ({ page }) => {
    let failed = false;
    await page.route(endpoint, route => route.fulfill(failed
      ? { status, json: { ok: false, error: { message: 'private-server-config' } } }
      : { json: { ok: true, data: [connected()] } }));
    await reports(page);
    await expect(chip(page)).toHaveAttribute('data-health', 'connected');
    failed = true;
    await page.clock.runFor(30_100);
    await expect(chip(page)).toHaveAttribute('data-health', 'unknown');
    await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
    await expect(page.locator('.app-main > section')).not.toContainText('private-server-config');
  });
}

test('browser offline invalidates green immediately and online rechecks', async ({ page, context }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: [connected()] } }));
  await reports(page);
  await expect(chip(page)).toHaveAttribute('data-health', 'connected');
  await context.setOffline(true);
  await expect(chip(page)).toHaveAttribute('data-health', 'unknown');
  await expect(chip(page)).toHaveAttribute('title', /browser is offline/);
  await context.setOffline(false);
  await expect(chip(page)).toHaveAttribute('data-health', 'connected');
});

test('repeated responses with old evidence cannot keep a connection green', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data: [connected()] } }));
  await reports(page);
  await expect(chip(page)).toHaveAttribute('data-health', 'connected');
  await page.clock.runFor(61_100);
  await expect(chip(page)).toHaveAttribute('data-health', 'unknown');
  await expect(chip(page)).toHaveAttribute('title', /stale/);
});

test('loading and request timeout stay neutral; later refresh recovers', async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  let hold = true;
  await page.route(endpoint, async route => {
    if (hold) await pending;
    await route.fulfill({ json: { ok: true, data: [connected()] } }).catch(() => {});
  });
  await reports(page);
  await expect(chip(page)).toHaveAttribute('data-health', 'loading');
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
  await page.clock.runFor(8_100);
  await expect(chip(page)).toHaveAttribute('title', /timed out/);
  hold = false;
  finish();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(chip(page)).toHaveAttribute('data-health', 'connected');
});

test('HTML/non-JSON and network errors are not interpreted as connectivity', async ({ page }) => {
  let mode: 'html' | 'network' = 'html';
  await page.route(endpoint, route => mode === 'html'
    ? route.fulfill({ contentType: 'text/html', body: '<html>Fallback page</html>' })
    : route.abort('failed'));
  await reports(page);
  await expect(chip(page)).toHaveAttribute('title', /response is invalid/);
  mode = 'network';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(chip(page)).toHaveAttribute('title', /service is unreachable/);
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
});

test('user changes and logout discard the previous session status', async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, data:
    route.request().headers()['x-user-id'] === 'u-admin' ? [connected()] : [{ id: 'p6', configured: false }] } }));
  await reports(page);
  await expect(chip(page)).toHaveAttribute('data-health', 'connected');
  await page.locator('.auth-status > button').click();
  await page.locator('.auth-status select').selectOption('u-pm');
  await expect(chip(page)).toHaveAttribute('data-health', 'unknown');
  await expect(chip(page)).toHaveAttribute('title', /did not report this source/);
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  // پس از خروج هیچ نشانگر سبزی نباید باقی بماند، حتی اگر صفحه unmount شود.
  await expect(page.locator('[data-health="connected"]')).toHaveCount(0);
});
