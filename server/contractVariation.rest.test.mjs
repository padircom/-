/** سرور واقعی، دادهٔ موقت مستقل؛ بدون تغییر rundata کاربر. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRepository, JsonFileDriver } from './persistence/driver.mjs';
const PORT = 4795;
const BASE = `http://127.0.0.1:${PORT}`;
const url = '/api/cnt-variations/c1-p1/contracts/test-contract';
let dir, files, child, r;

async function api(method, route, user = 'u-contracts', body) {
  const res = await fetch(BASE + route, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user-id': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, ...await res.json() };
}
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cnt-variation-')); files = await mkdtemp(path.join(tmpdir(), 'cnt-variation-files-'));
  r = createRepository(new JsonFileDriver(dir));
  await r.create('ContractMaster', { Id: 'test-contract', ProjectId: 'c1-p1', Code: 'TEST-C', TitleFa: 'پیمان آزمون', ContractType: 'unit_price', Party: 'main', EmployerName: 'آزمون', ContractorName: 'آزمون', SignDate: '2026-01-01', StartDate: '2026-01-01', DurationDays: 100, InitialAmount: 1000, CurrentAmount: 1000, Currency: 'IRR', CeilingPct: 25, RetainagePct: 10, AdjustmentEnabled: false, Status: 'active' }, 'u-contracts');
  for (const [Id, ItemNo, Qty] of [['boq-1', '1', 10], ['boq-2', '2', 10], ['boq-3', '3', 10]]) {
    await r.create('ContractBOQ_Item', { Id, ProjectId: 'c1-p1', ContractId: 'test-contract', ItemNo, TitleFa: 'ردیف آزمون', PricingBasis: 'unit_price', Unit: 'متر', ContractQty: Qty, UnitRate: 100, LineAmount: Qty * 100, IsStarred: false, RateStatus: 'agreed', Status: 'active' }, 'u-contracts');
  }
  await r.create('MeasurementSheet', { ProjectId: 'c1-p1', ContractId: 'test-contract', BoqItemId: 'boq-3', SheetNo: 1, Quantity: 9, Status: 'verified' }, 'u-site');
  child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: 'json', DATA_DIR: dir, FILE_STORAGE_PATH: files }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { const res = await fetch(BASE + '/api/health'); if (res.status < 500 || res.status === 503) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Variation test API did not start');
});
after(async () => {
  if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; }
  if (dir) await rm(dir, { recursive: true, force: true });
  if (files) await rm(files, { recursive: true, force: true });
});
const common = { ReasonFa: 'دستور کار آزمون', DocumentRef: 'DOC-TEST' };
const qty = (ChangeNo, BoqItemId = 'boq-1', NewQty = 12) => ({ ...common, ChangeNo, BoqItemId, NewQty });
const extra = Code => ({ ...common, Code, TitleFa: 'کار جدید آزمون', Unit: 'متر', Quantity: 2, ProposedRate: 50, AnalysisMethod: 'rate_analysis' });
const transition = (kind, row, action, actor = 'u-contracts', more = {}) => api('POST', `${url}/${kind}/${row.Id}/transitions`, actor, { action, RowVersion: row.RowVersion, note: 'دلایل مستند', ...more });

test('role, project, evidence, field injection and generic write guards', async () => {
  assert.equal((await api('GET', url, null)).status, 401);
  assert.equal((await api('POST', `${url}/quantity`, 'u-planner', qty(1))).status, 403);
  assert.equal((await api('POST', `${url.replace('c1-p1', 'c9-p9')}/quantity`, 'u-contracts', qty(1))).status, 403);
  assert.equal((await api('POST', `${url}/quantity`, 'u-contracts', { ...qty(1), DocumentRef: '' })).status, 422);
  assert.equal((await api('POST', `${url}/extra`, 'u-contracts', { ...extra('BAD'), AgreedRate: 1 })).status, 422);
  for (const table of ['BOQ_QuantityChange', 'ExtraWorkItem']) {
    const out = await api('POST', `/api/data/${table}`, 'u-admin', {}); assert.equal(out.status, 403); assert.equal(out.error.code, 'TABLE_HAS_DEDICATED_API');
  }
});
test('quantity draft/edit/submit/approve changes BOQ once without changing contract amount', async () => {
  let out = await api('POST', `${url}/quantity`, 'u-contracts', qty(1)); assert.equal(out.status, 201); let row = out.data.item;
  assert.equal(row.DeltaAmount, 200); assert.equal(row.PreviousQty, 10);
  assert.equal((await api('POST', `${url}/quantity`, 'u-contracts', qty(1))).status, 409);
  out = await api('PATCH', `${url}/quantity/${row.Id}`, 'u-contracts', { ...qty(1, 'boq-1', 13), RowVersion: row.RowVersion }); assert.equal(out.status, 200); row = out.data.item;
  out = await transition('quantity', row, 'submit'); assert.equal(out.status, 200); row = out.data.item;
  assert.equal((await transition('quantity', row, 'approve')).status, 403);
  const versions = await Promise.all([1, 2].map(() => transition('quantity', row, 'approve', 'u-pm'))); assert.deepEqual(versions.map(r => r.status).sort(), [200, 409]);
  const state = (await api('GET', url)).data; assert.equal(state.boq.find(b => b.Id === 'boq-1').ContractQty, 13); assert.equal(state.boq.find(b => b.Id === 'boq-1').LineAmount, 1300);
  assert.equal((await api('GET', '/api/cnt/contracts/test-contract?projectId=c1-p1')).data.contract.CurrentAmount, 1000);
  assert.equal((await api('POST', '/api/cnt/boq?projectId=c1-p1', 'u-contracts', { contractId: 'test-contract', itemNo: '1', titleFa: 'ویرایش غیرمجاز', pricingBasis: 'unit_price', unit: 'متر', contractQty: 99, unitRate: 100, allowUpdate: true })).status, 409);
});
test('extra work requires explicit agreed rate and creates one starred BOQ item atomically', async () => {
  let out = await api('POST', `${url}/extra`, 'u-contracts', extra('EW-1')); assert.equal(out.status, 201); let row = out.data.item;
  assert.equal((await api('GET', url)).data.boq.some(b => b.ItemNo === 'EW-1'), false);
  row = (await transition('extra', row, 'submit')).data.item;
  assert.equal((await transition('extra', row, 'approve', 'u-pm')).status, 422);
  let state = (await api('GET', url)).data; assert.equal(state.extras.find(x => x.Id === row.Id).Status, 'rate_pending'); assert(!state.boq.some(b => b.ItemNo === 'EW-1'));
  const result = await transition('extra', row, 'approve', 'u-pm', { AgreedRate: 60 }); assert.equal(result.status, 200);
  state = (await api('GET', url)).data; const boq = state.boq.find(b => b.ItemNo === 'EW-1'); assert(boq.IsStarred); assert.equal(boq.UnitRate, 60); assert.equal(boq.LineAmount, 120);
  assert.equal(state.extras.find(x => x.Id === row.Id).BoqItemId, boq.Id);
  assert.equal((await transition('extra', row, 'approve', 'u-pm', { AgreedRate: 70 })).status, 409);
  assert.equal((await api('GET', '/api/cnt/contracts/test-contract?projectId=c1-p1')).data.contract.CurrentAmount, 1000);
  const fresh = createRepository(new JsonFileDriver(dir)); assert.equal((await fresh.get('ExtraWorkItem', row.Id)).Status, 'agreed'); assert((await fresh.list('AuditLog', { limit: 100 })).some(a => a.Action === 'CNT_VARIATION_APPROVE'));
});
test('stale BOQ snapshots rejected, draft can rebase, rejected requests do not affect BOQ', async () => {
  let row = (await api('POST', `${url}/quantity`, 'u-contracts', qty(10, 'boq-2'))).data.item;
  const old = row;
  const changed = await api('POST', '/api/cnt/boq?projectId=c1-p1', 'u-contracts', { contractId: 'test-contract', itemNo: '2', titleFa: 'ویرایش مبنا', pricingBasis: 'unit_price', unit: 'متر', contractQty: 11, unitRate: 100, allowUpdate: true }); assert.equal(changed.status, 200);
  assert.equal((await transition('quantity', row, 'submit')).status, 409);
  row = (await api('PATCH', `${url}/quantity/${row.Id}`, 'u-contracts', { ...qty(10, 'boq-2'), RowVersion: row.RowVersion })).data.item;
  assert.equal((await transition('quantity', old, 'submit')).status, 409);
  row = (await transition('quantity', row, 'submit')).data.item;
  assert.equal((await transition('quantity', row, 'reject', 'u-pm')).status, 200);
  assert.equal((await api('GET', url)).data.boq.find(b => b.Id === 'boq-2').ContractQty, 11);
});
test('reduction below verified work rolls back approval; cancel without BOQ effects', async () => {
  let row = (await api('POST', `${url}/quantity`, 'u-contracts', qty(1, 'boq-3', 0))).data.item;
  row = (await transition('quantity', row, 'submit')).data.item;
  assert.equal((await transition('quantity', row, 'approve', 'u-pm')).status, 422);
  let extraRow = (await api('POST', `${url}/extra`, 'u-contracts', extra('CANCEL-EW'))).data.item;
  assert.equal((await transition('extra', extraRow, 'cancel')).status, 200);
  assert(!(await api('GET', url)).data.boq.some(b => b.ItemNo === 'CANCEL-EW'));
});

test('approval collision with an existing BOQ item leaves request pending and no partial effect', async () => {
  let row = (await api('POST', `${url}/extra`, 'u-contracts', extra('EW-COLLISION'))).data.item;
  row = (await transition('extra', row, 'submit')).data.item;
  const initial = await api('POST', '/api/cnt/boq?projectId=c1-p1', 'u-contracts', { contractId: 'test-contract', itemNo: 'EW-COLLISION', titleFa: 'ردیف پایه', pricingBasis: 'unit_price', unit: 'متر', contractQty: 1, unitRate: 1 }); assert.equal(initial.status, 201);
  assert.equal((await transition('extra', row, 'approve', 'u-pm', { AgreedRate: 60 })).status, 409);
  const data = (await api('GET', url)).data;
  assert.equal(data.extras.find(x => x.Id === row.Id).Status, 'rate_pending'); assert.equal(data.boq.filter(b => b.ItemNo === 'EW-COLLISION').length, 1); assert.equal(data.boq.find(b => b.ItemNo === 'EW-COLLISION').LineAmount, 1);
});
test('managed item metadata remains editable, but stale approvals and foreign parents are refused', async () => {
  const old = (await api('GET', url)).data.boq.find(b => b.Id === 'boq-1');
  const result = await api('POST', '/api/cnt/boq?projectId=c1-p1', 'u-contracts', { contractId: 'test-contract', itemNo: '1', titleFa: 'تکمیل نگاشت', pricingBasis: 'unit_price', unit: 'متر', contractQty: old.ContractQty, unitRate: old.UnitRate, wbsId: 'real-wbs-ref', allowUpdate: true }); assert.equal(result.status, 200);
  let row = (await api('POST', `${url}/quantity`, 'u-contracts', qty(99, 'boq-2', 14))).data.item;
  row = (await transition('quantity', row, 'submit')).data.item;
  assert.equal((await api('POST', `${url.replace('test-contract', 'absent-parent')}/quantity/${row.Id}/transitions`, 'u-pm', { action: 'approve', RowVersion: row.RowVersion, note: 'wrong parent' })).status, 404);
  assert.equal((await api('PATCH', `${url}/quantity/${row.Id}`, 'u-contracts', { ...qty(99, 'boq-2', 15), RowVersion: row.RowVersion })).status, 409);
});
