import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

// Compile the isolated client policy, not any server bundle or business dataset.
const { code } = await transform(await readFile(new URL('../../src/services/dataSourceHealth.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' });
const { parseHealthSnapshot, sourceHealth, HEALTH_MAX_AGE_MS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const now = Date.parse('2026-09-29T10:00:00Z');
const checkedAt = new Date(now).toISOString();
const snapshot = (items, meta = {}) => parseHealthSnapshot({ ok: true, data: items, meta }, 'u-admin', now);
const state = (item, time = now) => sourceHealth(snapshot([{ id: 'p6', ...item }]), 'p6', time);

test('configured/ready/API availability is not a verified connection', () => {
  for (const item of [{ configured: true, mode: 'api' }, { status: 'ready' }, { status: 'healthy' }]) {
    assert.equal(state(item).status, 'unknown');
    assert.equal(state(item).latencyMs, null);
  }
  assert.equal(sourceHealth(snapshot([{ id: 'p6', configured: true }], { timestamp: checkedAt }), 'p6', now).status, 'unknown');
});
test('missing sources and file imports never turn green', () => {
  assert.equal(sourceHealth(snapshot([]), 'das', now).reason, 'missing');
  assert.equal(state({ configured: true, mode: 'file-import', connected: true, checkedAt }).reason, 'file-import');
  assert.equal(state({ configured: false, connected: true, checkedAt }).reason, 'unconfigured');
});
test('only fresh explicit connectivity confirms green; latency is measured per source', () => {
  assert.equal(state({ connected: true, checkedAt, latencyMs: 18.5 }).status, 'connected');
  assert.equal(state({ connected: true, checkedAt, latencyMs: 18.5 }).latencyMs, 18.5);
  assert.equal(state({ connected: true, checkedAt, latencyMs: 0 }).latencyMs, 0);
  for (const latencyMs of [undefined, -1, NaN, Infinity, '18ms']) assert.equal(state({ connected: true, checkedAt, latencyMs }).latencyMs, null);
  assert.equal(state({ connected: false }).reason, 'disconnected');
  assert.equal(state({ connected: 'true', checkedAt }).status, 'unknown');
});
test('missing, invalid and implausibly future timestamps cannot confirm connectivity', () => {
  for (const value of [undefined, null, '', 'bad-date', new Date(now + 60_000).toISOString()]) {
    assert.equal(state({ connected: true, checkedAt: value }).reason, 'unverified');
  }
});
test('both old per-source evidence and expired snapshots invalidate green', () => {
  assert.equal(state({ connected: true, checkedAt: new Date(now - HEALTH_MAX_AGE_MS - 1).toISOString() }).reason, 'stale');
  assert.equal(state({ connected: true, checkedAt }, now + HEALTH_MAX_AGE_MS + 1).reason, 'stale');
});
test('Power BI API identity maps to the existing sidebar id', () => {
  const result = snapshot([{ id: 'powerbi', connected: true, checkedAt }]);
  assert.equal(sourceHealth(result, 'pbi', now).status, 'connected');
  assert.equal(sourceHealth(result, 'das', now).status, 'unknown');
});
test('bad envelopes, duplicate identities and degraded responses fail closed', () => {
  for (const body of [null, {}, { ok: false, data: [] }, { ok: true, data: {} }, { ok: true, data: [null] },
    { ok: true, data: [{ id: 'powerbi' }, { id: 'pbi' }] },
    { ok: true, data: [{ id: 'p6', connected: true, checkedAt }], meta: { degraded: true } }]) {
    const result = parseHealthSnapshot(body, 'u-admin', now);
    assert.equal(sourceHealth(result, 'p6', now).reason, 'malformed');
  }
});
test('transport and session failures override even previously successful entries', () => {
  for (const error of ['loading', 'offline', 'signed-out', 'unauthorized', 'forbidden', 'network', 'timeout', 'unavailable']) {
    const result = { ...snapshot([{ id: 'p6', connected: true, checkedAt }]), error };
    assert.notEqual(sourceHealth(result, 'p6', now).status, 'connected');
    assert.equal(sourceHealth(result, 'p6', now).latencyMs, null);
  }
});
