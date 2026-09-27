import { lockRuntimeTests } from './runtimeTestLock.mjs';
let releaseRuntimeLock;
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { TABLE_ACCESS } from './dataAccess.js';
import { PERMISSION_CATALOG } from './rbacLogic.js';

const base = 'http://127.0.0.1:4797';
const project = `sec-${Date.now()}`;
let child;
const created = [];
async function request(path, user, method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user-id': user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
before(async () => {
  releaseRuntimeLock = await lockRuntimeTests();
  child = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: '4797', PERSIST_DRIVER: 'json', DATA_DIR: './server/rundata' }, stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/integration/status')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Security test server did not start');
});
after(async () => {
  if (!releaseRuntimeLock) return;
  try {
  for (const id of created) await request(`/api/data/Activity/${id}`, 'u-planner', 'DELETE');
  const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
  } finally { await releaseRuntimeLock(); }
});

test('SEC-1: every exposed table has explicit valid read/write permissions', async () => {
  const schema = await request('/api/data/schema');
  // Policy/catalog consistency also catches typo permissions that deny all users.
  const permissions = new Set(PERMISSION_CATALOG.map(p => p.code));
  for (const pair of Object.values(TABLE_ACCESS)) for (const p of pair) assert.ok(permissions.has(p), p);
  assert.deepEqual(schema.body.data.tables.filter(t => t.exposed).map(t => t.name).sort(), Object.keys(TABLE_ACCESS).sort());
});
for (const [name, user, expected] of [['anonymous', null, 401], ['unknown', 'nobody', 401], ['inactive', 'u-left', 401], ['wrong role', 'u-admin', 403]]) {
  test(`SEC-1: ${name} cannot read or mutate Activity`, async () => {
    for (const [method, suffix] of [['GET', ''], ['GET', '/missing'], ['POST', ''], ['PATCH', '/missing'], ['DELETE', '/missing']]) {
      const r = await request('/api/data/Activity' + suffix, user, method, method === 'POST' || method === 'PATCH' ? {} : undefined);
      assert.equal(r.status, expected, JSON.stringify(r));
    }
  });
}
test('SEC-1: authorized CRUD and scope isolation use persisted row, not query projectId', async () => {
  const r = await request('/api/data/Activity', 'u-planner', 'POST', { ProjectId: project, Code: project, NameFa: 'امنیت', PlannedStart: '2026-09-01', PlannedFinish: '2026-09-20' });
  assert.equal(r.status, 201, JSON.stringify(r)); created.push(r.body.data.Id);
  const id = r.body.data.Id;
  assert.equal((await request(`/api/data/Activity/${id}`, 'u-planner')).status, 200);
  assert.equal((await request(`/api/data/Activity/${id}?projectId=c1-p1`, 'u-pm')).status, 403);
  const list = await request(`/api/data/Activity?where=ProjectId:eq:${project}`, 'u-pm');
  assert.equal(list.status, 200); assert.equal(list.body.data.total, 0);
  assert.equal((await request(`/api/data/Activity/${id}`, 'u-planner', 'PATCH', { NameFa: 'ویرایش' })).status, 200);
});
test('SEC-1: system admin is not implicitly a schedule editor', async () => {
  assert.equal((await request('/api/data/Activity', 'u-admin', 'POST', {})).status, 403);
});
test('SEC-1: dedicated CKM tables remain inaccessible even to system admin', async () => {
  assert.equal((await request('/api/data/Correspondence', 'u-admin')).status, 403);
});
const csv = code => `Code,NameFa,PlannedStart,PlannedFinish\n${code},امنیت,2026-09-01,2026-09-20`;
for (const [name, user, status] of [['anonymous', null, 401], ['wrong role', 'u-admin', 403], ['inactive', 'u-left', 401]]) {
  test(`ITG SEC-1: ${name} cannot commit Excel/CSV template`, async () => {
    const code = project + name.replaceAll(' ', '');
    const r = await request(`/api/integration/import/TPL-ACT?commit=1&projectId=${project}`, user, 'POST', { content: csv(code) });
    assert.equal(r.status, status);
    const rows = await request(`/api/data/Activity?where=Code:eq:${code}`, 'u-planner');
    assert.equal(rows.body.data.total, 0);
  });
}
test('ITG SEC-1: preview stays read-only; commit/upsert requires target-table permission', async () => {
  const body = { content: csv(project + '-import') };
  assert.equal((await request('/api/integration/import/TPL-ACT', null, 'POST', body)).status, 200);
  // SEC-1: importer now identifies the planner rather than relying on anonymous write access.
  for (let i = 0; i < 2; i++) {
    const r = await request(`/api/integration/import/TPL-ACT?commit=1&projectId=${project}`, 'u-planner', 'POST', body);
    assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.body.data.written, 1);
    assert.equal(r.body.data.inserted, i === 0 ? 1 : 0);
  }
  const rows = await request(`/api/data/Activity?where=Code:eq:${project}-import`, 'u-planner');
  assert.equal(rows.body.data.total, 1); created.push(rows.body.data.items[0].Id);
});

test('SEC-1: raw PATCH cannot change primary key or erase/move project scope', async () => {
  const id = created[0];
  for (const body of [{ Id: 'moved' }, { ProjectId: 'other' }, { ProjectId: null }, { ProjectId: '' }]) {
    assert.equal((await request(`/api/data/Activity/${id}`, 'u-planner', 'PATCH', body)).status, 400);
  }
});
test('ITG SEC-1: missing project cannot upsert a matching code across projects', async () => {
  const r = await request('/api/integration/import/TPL-ACT?commit=1', 'u-planner', 'POST', { content: csv(project + '-import') });
  assert.equal(r.status, 400); assert.equal(r.body.error.code, 'NO_PROJECT');
});
test('ITG SEC-1: XER commit and preview enforce schedule permissions', async () => {
  const content = `%T\tTASK\n%F\ttask_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\n%R\t1\t${project}-xer\tامنیت\t2026-09-01\t2026-09-20\n%E`;
  for (const [user, status] of [[null, 401], ['u-admin', 403]]) {
    for (const commit of [0, 1]) assert.equal((await request(`/api/integration/xer?projectId=${project}&commit=${commit}`, user, 'POST', { content })).status, status);
  }
  const r = await request(`/api/integration/xer?projectId=${project}&commit=1`, 'u-planner', 'POST', { content });
  assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.body.data.written.activities, 1);
  const rows = await request(`/api/data/Activity?where=Code:eq:${project}-xer`, 'u-planner');
  created.push(...rows.body.data.items.map(row => row.Id));
});

test('SEC-1: unscoped relations fail closed and project creation cannot omit scope', async () => {
  assert.equal((await request('/api/data/ActivityRelation', 'u-pm')).status, 403);
  assert.equal((await request('/api/data/Project', 'u-pm', 'POST', {})).status, 400);
});
