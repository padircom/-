/** سرور واقعی، دادهٔ موقت مستقل؛ بدون تغییر rundata کاربر. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRepository, JsonFileDriver } from './persistence/driver.mjs';
const PORT = 4793;
const BASE = `http://127.0.0.1:${PORT}`;
const url = '/api/cnt-amendments/c1-p1/contracts/test-contract';
let dir, files, child, r;
const input = Code => ({ Code, TitleFa: 'الحاقیهٔ آزمون', AmendmentType: 'amount', EffectiveDate: '2026-10-25', AmountDelta: 50, DurationDeltaDays: 10, DocumentRef: 'TEST-DOC' });
async function api(method, route, user = 'u-contracts', body) {
  const res = await fetch(BASE + route, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user-id': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, ...await res.json() };
}
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cnt-amendment-')); files = await mkdtemp(path.join(tmpdir(), 'cnt-amendment-files-'));
  r = createRepository(new JsonFileDriver(dir));
  await r.create('ContractMaster', { Id: 'test-contract', ProjectId: 'c1-p1', Code: 'TEST-C', TitleFa: 'پیمان آزمون', ContractType: 'unit_price', Party: 'main', EmployerName: 'آزمون', ContractorName: 'آزمون', SignDate: '2026-01-01', StartDate: '2026-01-01', DurationDays: 100, InitialAmount: 1000, CurrentAmount: 1000, Currency: 'IRR', CeilingPct: 25, RetainagePct: 10, AdjustmentEnabled: false, Status: 'active' }, 'u-contracts');
  await r.create('ContractAmendment', { ...input('PM-SELF'), Id: 'self-amendment', ProjectId: 'c1-p1', ContractId: 'test-contract', Status: 'submitted', SubmittedBy: 'u-contracts' }, 'u-pm');
  child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: 'json', DATA_DIR: dir, FILE_STORAGE_PATH: files }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { const res = await fetch(BASE + '/api/health'); if (res.status < 500 || res.status === 503) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Amendment test API did not start');
});
after(async () => {
  if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
  if (dir) await rm(dir, { recursive: true, force: true });
  if (files) await rm(files, { recursive: true, force: true });
});
test('authentication, project scoping, unauthorized roles, generic write guard', async () => {
  assert.equal((await api('GET', url, null)).status, 401);
  assert.equal((await api('POST', url, 'u-planner', input('DENIED'))).status, 403);
  assert.equal((await api('POST', url.replace('c1-p1', 'c9-p9'), 'u-contracts', input('SCOPE'))).status, 403);
  assert.equal((await api('GET', url.replace('c1-p1', 'c1-p2'))).status, 404);
  const generic = await api('POST', '/api/data/ContractAmendment', 'u-admin', input('BYPASS'));
  assert.equal(generic.status, 403); assert.equal(generic.error.code, 'TABLE_HAS_DEDICATED_API');
});
let approvedId;
test('create, duplicate, edit draft, submit, independent approve, atomic current amount, persistence', async () => {
  let out = await api('POST', url, 'u-contracts', input('A-1')); assert.equal(out.status, 201); let row = out.data.item; approvedId = row.Id;
  assert.equal((await api('POST', url, 'u-contracts', input('A-1'))).status, 409);
  assert.equal((await api('POST', url, 'u-contracts', { ...input('INJECT'), Status: 'approved' })).status, 422);
  assert.equal((await api('PATCH', `${url}/${row.Id}`, 'u-contracts', { ...input('A-1'), RowVersion: 0 })).status, 409);
  out = await api('PATCH', `${url}/${row.Id}`, 'u-contracts', { ...input('A-1'), AmountDelta: 100, RowVersion: row.RowVersion }); assert.equal(out.status, 200); row = out.data.item;
  out = await api('POST', `${url}/${row.Id}/transitions`, 'u-contracts', { action: 'submit', RowVersion: row.RowVersion }); assert.equal(out.status, 200); row = out.data.item;
  assert.equal((await api('GET', '/api/cnt/contracts/test-contract?projectId=c1-p1')).data.contract.CurrentAmount, 1000);
  assert.equal((await api('PATCH', `${url}/${row.Id}`, 'u-contracts', { ...input('A-1'), RowVersion: row.RowVersion })).status, 409);
  assert.equal((await api('POST', `${url}/${row.Id}/transitions`, 'u-contracts', { action: 'approve', RowVersion: row.RowVersion, note: 'self' })).status, 403);
  out = await api('POST', `${url}/${row.Id}/transitions`, 'u-pm', { action: 'approve', RowVersion: row.RowVersion, note: 'مستندات بررسی و تأیید شد' }); assert.equal(out.status, 200);
  assert.equal((await api('POST', `${url}/${row.Id}/transitions`, 'u-pm', { action: 'approve', RowVersion: row.RowVersion, note: 'repeat' })).status, 409);
  const workspace = await api('GET', url); assert.equal(workspace.data.currentAmount, 1100); assert.equal(workspace.data.currentDurationDays, 110);
  const contract = (await api('GET', '/api/cnt/contracts/test-contract?projectId=c1-p1')).data.contract; assert.equal(contract.CurrentAmount, 1100); assert.equal(contract.DurationDays, 100);
  const fresh = createRepository(new JsonFileDriver(dir)); assert.equal((await fresh.get('ContractAmendment', row.Id)).Status, 'approved');
  assert((await fresh.list('AuditLog', { limit: 100 })).some(a => a.Action === 'CNT_AMENDMENT_APPROVE'));
});
test('reject and cancel are terminal without financial effects', async () => {
  for (const action of ['cancel', 'reject']) {
    let row = (await api('POST', url, 'u-contracts', input(`A-${action}`))).data.item;
    if (action === 'reject') row = (await api('POST', `${url}/${row.Id}/transitions`, 'u-contracts', { action: 'submit', RowVersion: row.RowVersion })).data.item;
    const out = await api('POST', `${url}/${row.Id}/transitions`, action === 'reject' ? 'u-pm' : 'u-contracts', { action, RowVersion: row.RowVersion, note: 'دلایل مستند آزمون' }); assert.equal(out.status, 200);
    assert.equal((await api('PATCH', `${url}/${row.Id}`, 'u-contracts', { ...input('changed'), RowVersion: out.data.item.RowVersion })).status, 409);
  }
  assert.equal((await api('GET', url)).data.currentAmount, 1100);
});
test('invalid financial effect rolls back status and audit; simultaneous approvals apply once', async () => {
  let row = (await api('POST', url, 'u-contracts', { ...input('A-NEG'), AmountDelta: -2000 })).data.item;
  row = (await api('POST', `${url}/${row.Id}/transitions`, 'u-contracts', { action: 'submit', RowVersion: row.RowVersion })).data.item;
  assert.equal((await api('POST', `${url}/${row.Id}/transitions`, 'u-pm', { action: 'approve', RowVersion: row.RowVersion, note: 'بررسی' })).status, 422);
  let items = (await api('GET', url)).data.items; assert.equal(items.find(a => a.Id === row.Id).Status, 'submitted');
  row = (await api('POST', url, 'u-contracts', input('A-RACE'))).data.item;
  row = (await api('POST', `${url}/${row.Id}/transitions`, 'u-contracts', { action: 'submit', RowVersion: row.RowVersion })).data.item;
  const results = await Promise.all([1, 2].map(() => api('POST', `${url}/${row.Id}/transitions`, 'u-pm', { action: 'approve', RowVersion: row.RowVersion, note: 'بررسی' })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await api('GET', url)).data.currentAmount, 1150);
});

test('authorized approver cannot approve own record; document/date validation and foreign contract guards', async () => {
  assert.equal((await api('POST', url, 'u-contracts', { ...input('NO-DOC'), DocumentRef: '' })).status, 422);
  assert.equal((await api('POST', url, 'u-contracts', { ...input('BAD-DATE'), EffectiveDate: '2026-02-30' })).status, 422);
  const row = (await api('GET', url)).data.items.find(a => a.Id === 'self-amendment');
  const result = await api('POST', `${url}/${row.Id}/transitions`, 'u-pm', { action: 'approve', RowVersion: row.RowVersion, note: 'self' });
  assert.equal(result.status, 403); assert.equal(result.error.code, 'E-CNT-AMENDMENT-SOD');
  assert.equal((await api('POST', `${url}/${row.Id}/transitions`, 'u-client', { action: 'reject', RowVersion: row.RowVersion })).status, 422);
  assert.equal((await api('POST', `${url.replace('test-contract', 'foreign-contract')}/${row.Id}/transitions`, 'u-pm', { action: 'approve', RowVersion: row.RowVersion, note: 'wrong parent' })).status, 404);
});
