import { lockRuntimeTests } from './runtimeTestLock.mjs';
let releaseRuntimeLock;
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRepository, JsonFileDriver } from './persistence/driver.mjs';
const BASE = 'http://127.0.0.1:4798';
const DIR = './server/rundata';
const prefix = `rcc-test-${Date.now()}`;
const today = new Date().toISOString().slice(0, 10);
const baselineId = prefix + '-baseline';
let child;
const fixtureRepo = () => createRepository(new JsonFileDriver(DIR));
async function start() {
  child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: '4798', PERSIST_DRIVER: 'json', DATA_DIR: DIR }, stdio: 'ignore' });
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(BASE + '/api/integration/status')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('RCC test server did not start');
}
async function stop() { if (!child) return; const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit; child = null; }
async function request(path, user = 'u-pm', method = 'GET', body) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user-id': user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const call = (p, user, method, body) => request('/api/rcc/c1-p1' + p, user, method, body);
const ws = async (user = 'u-pm') => { const r = await call('/workspace', user); assert.equal(r.status, 200, JSON.stringify(r)); return r.body.data; };
async function create(kind, body, user) {
  const r = await call('/' + kind, user, 'POST', body); assert.equal(r.status, 201, JSON.stringify(r)); return r.body.data;
}
const riskBody = n => ({ Code: prefix + '-r' + n, TitleFa: 'ریسک آزمون', Category: 'CON', Probability: 4, Impact: 5, Owner: 'کارگاه', Cause: 'علت', Event: 'رویداد', Effect: 'اثر', Response: 'اقدام' });
const dims = Object.fromEntries(['Scope', 'Schedule', 'Cost', 'Quality', 'Risk', 'Resource', 'HSE', 'Contract', 'Interface', 'Commissioning', 'Stakeholder', 'Environment'].map(k => [k, true]));
const changeBody = n => ({ Code: prefix + '-c' + n, TitleFa: 'تغییر آزمون', Reason: 'دلیل', CostImpact: 150, TimeImpactDays: 3, Assessment: dims });
const claimBody = n => ({ Code: prefix + '-q' + n, TitleFa: 'ادعای آزمون', EventDate: today, NoticeDays: 28, Clause: 'بند ۲۰', Amount: 200, ExtensionDays: 5, BaselineId: baselineId, DataDate: today, Entitlement: 'استحقاق', Causation: 'سببیت', QuantumNote: 'آنالیز مستند', EvidenceRef: 'DOC-1' });
let persistedRisk;
before(async () => {
  releaseRuntimeLock = await lockRuntimeTests();
  // Isolated rows in the mandated runtime directory; no copied sample database.
  await fixtureRepo().create('Baseline', { Id: baselineId, ProjectId: 'c1-p1', Name: prefix, SetAt: new Date().toISOString(), SetBy: 'u-planner', IsCurrent: true, Snapshot: { budget: 1000, physicalPct: 20 } });
  // Historical/self-authored record: force the independent SoD guard, not just role denial.
  await fixtureRepo().create('ChangeRequest', { ...changeBody('self'), Id: prefix + '-self', ProjectId: 'c1-p1', RaisedBy: 'u-client', RaisedAt: today, Status: 'draft' }, 'u-client');
  await fixtureRepo().create('Baseline', { Id: prefix + '-foreign-baseline', ProjectId: 'c1-p2', Name: prefix + '-foreign', SetAt: new Date().toISOString(), SetBy: 'u-planner', IsCurrent: true });
  await start();
});
after(async () => {
  if (!releaseRuntimeLock) return;
  try {
  await stop();
  // Remove only this suite's records, never the user's runtime directory.
  const r = fixtureRepo();
  for (const table of ['Risk', 'ChangeRequest', 'Claim', 'AuditLog', 'Baseline']) {
    for (const row of await r.list(table)) if (String(row.Code ?? row.Name ?? row.Details?.code ?? '').startsWith(prefix)) await r.remove(table, row.Id);
  }
  } finally { await releaseRuntimeLock(); }
});
test('LIVE-3 REST: identity, per-project scope and confidential claim filtering', async () => {
  assert.equal((await call('/workspace', null)).status, 401);
  assert.equal((await call('/workspace', 'u-left')).status, 401);
  assert.equal((await call('/workspace', 'u-admin')).status, 403);
  assert.equal((await request('/api/rcc/not-my-project/workspace')).status, 403);
  // Planner can view risks but not confidential claims; site role has no RCC permission.
  assert.equal((await call('/workspace', 'u-site')).status, 403);
  const planner = await ws('u-planner'); assert.equal(planner.claimsHidden, true); assert.deepEqual(planner.claims, []);
});
test('LIVE-3 REST: raw routes closed to all roles and old synthetic endpoints retired', async () => {
  for (const table of ['Risk', 'ChangeRequest', 'Claim']) {
    assert.equal((await request('/api/data/' + table, 'u-admin')).status, 403);
    assert.equal((await request('/api/data/' + table, 'u-pm', 'POST', {})).status, 403);
  }
  assert.equal((await request('/api/rcc/notices')).status, 410);
  assert.equal((await request('/api/rcc/guardian/tick', 'u-pm', 'POST', {})).status, 410);
});
test('LIVE-3 REST: risk stored with computed score and server-selected project/actor', async () => {
  persistedRisk = await create('risks', { ...riskBody(1), Score: 999, ProjectId: 'other', CreatedBy: 'spoof' }, 'u-pm');
  assert.equal(persistedRisk.Score, 20); assert.equal(persistedRisk.CreatedBy, 'u-pm'); assert.equal(persistedRisk.ProjectId, 'c1-p1');
  assert.equal((await call('/risks', 'u-site', 'POST', riskBody(2))).status, 403);
  assert.equal((await call('/risks', 'u-pm', 'POST', { ...riskBody(2), Probability: 8 })).status, 400);
  assert.equal((await call('/risks', 'u-pm', 'POST', riskBody(1))).status, 409);
});
test('LIVE-3 REST: optimistic updates, cross-project ID and immutable code', async () => {
  const body = { ...riskBody(1), Probability: 2, RowVersion: persistedRisk.RowVersion };
  const result = await call('/risks/' + persistedRisk.Id, 'u-pm', 'PATCH', body); assert.equal(result.status, 200); assert.equal(result.body.data.Score, 10);
  assert.equal((await call('/risks/' + persistedRisk.Id, 'u-pm', 'PATCH', body)).status, 409);
  assert.equal((await request('/api/rcc/c1-p2/risks/' + persistedRisk.Id, 'u-pm', 'PATCH', body)).status, 404);
  persistedRisk = result.body.data;
});
test('LIVE-3 REST: change draft ignores approval spoofing and checks impact gate', async () => {
  const c = await create('changes', { ...changeBody(1), Assessment: {}, Status: 'approved', ApprovedBy: 'spoof' }, 'u-pm');
  assert.equal(c.Status, 'draft'); assert.ok(!c.ApprovedBy);
  assert.equal((await call(`/changes/${c.Id}/decision`, 'u-pm', 'POST', { decision: 'approved', reason: 'ok', RowVersion: 1 })).status, 403);
  assert.equal((await call(`/changes/${c.Id}/decision`, 'u-client', 'POST', { decision: 'approved', reason: 'ok', RowVersion: 1 })).status, 422);
});
test('LIVE-3 REST: change approval locks record and concurrent decision cannot overwrite it', async () => {
  const c = await create('changes', changeBody(2), 'u-pm');
  const results = await Promise.all(['approved', 'rejected'].map(decision => call(`/changes/${c.Id}/decision`, 'u-client', 'POST', { decision, reason: 'بررسی شد', RowVersion: c.RowVersion })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await call('/changes/' + c.Id, 'u-pm', 'PATCH', { ...changeBody(2), RowVersion: 2 })).status, 409);
});
test('LIVE-3 REST: incomplete claim cannot submit and notice does not fabricate external delivery', async () => {
  const c = await create('claims', { ...claimBody(1), EvidenceRef: '', Status: 'submitted', TimeBarred: false }, 'u-contracts');
  assert.equal(c.Status, 'draft'); assert.ok(!c.SubmittedAt);
  assert.equal((await call(`/claims/${c.Id}/submit`, 'u-pm', 'POST', { RowVersion: 1 })).status, 422);
  const notice = await call(`/claims/${c.Id}/notice`, 'u-contracts', 'POST', { NoticeRef: 'LETTER-TEST', NoticeDeliveredAt: '2000-01-01', RowVersion: 1 });
  assert.equal(notice.status, 200); assert.equal(notice.body.data.NoticeDate, today);
  assert.equal((await call(`/claims/${c.Id}/submit`, 'u-pm', 'POST', { RowVersion: 2 })).status, 422);
  // Notice deadline cannot be rewritten; evidence can be completed after notice.
  assert.equal((await call('/claims/' + c.Id, 'u-contracts', 'PATCH', { ...claimBody(1), NoticeDays: 100, RowVersion: 2 })).status, 409);
  const completed = await call('/claims/' + c.Id, 'u-contracts', 'PATCH', { ...claimBody(1), RowVersion: 2 }); assert.equal(completed.status, 200);
  const submitted = await call(`/claims/${c.Id}/submit`, 'u-pm', 'POST', { RowVersion: completed.body.data.RowVersion }); assert.equal(submitted.status, 200, JSON.stringify(submitted));
  assert.equal(submitted.body.data.Status, 'submitted'); assert.equal(submitted.body.data.SubmittedBy, 'u-pm');
  assert.equal((await call('/claims/' + c.Id, 'u-contracts', 'PATCH', { ...claimBody(1), RowVersion: 4 })).status, 409);
});
test('LIVE-3 REST: late notice remains barred and no-baseline claim is blocked', async () => {
  const q = await create('claims', { ...claimBody(2), EventDate: '2000-01-01', BaselineId: 'missing' }, 'u-contracts');
  assert.equal(q.TimeBarred, true);
  const n = await call(`/claims/${q.Id}/notice`, 'u-contracts', 'POST', { NoticeRef: 'LATE', RowVersion: 1 }); assert.equal(n.status, 200);
  assert.equal((await call(`/claims/${q.Id}/submit`, 'u-pm', 'POST', { RowVersion: 2 })).status, 422);
});
test('LIVE-3 REST: approver cannot approve their own historical draft', async () => {
  const r = await call(`/changes/${prefix}-self/decision`, 'u-client', 'POST', { decision: 'approved', reason: 'self', RowVersion: 1 });
  assert.equal(r.status, 403); assert.equal(r.body.error.code, 'RCC_SOD');
});
test('LIVE-3 REST: current baseline of another project cannot authorize a claim', async () => {
  const c = await create('claims', { ...claimBody(3), BaselineId: prefix + '-foreign-baseline' }, 'u-contracts');
  assert.equal((await call(`/claims/${c.Id}/notice`, 'u-contracts', 'POST', { NoticeRef: 'NOTICE-3', RowVersion: 1 })).status, 200);
  const r = await call(`/claims/${c.Id}/submit`, 'u-pm', 'POST', { RowVersion: 2 });
  assert.equal(r.status, 422); assert.match(r.body.error.message, /CurrentBaseline/);
});
test('LIVE-3 REST: server restart retains rows, completed decisions, claims and audit trail', async () => {
  await stop(); await start();
  const w = await ws();
  assert.equal(w.risks.find(r => r.Id === persistedRisk.Id).Score, 10);
  assert.equal(w.claims.find(r => r.Code === prefix + '-q1').Status, 'submitted');
  const r = fixtureRepo();
  const logs = (await r.list('AuditLog')).filter(row => row.Details?.code?.startsWith(prefix));
  assert.ok(logs.some(row => row.Action === 'RCC_SUBMIT'));
  assert.ok(logs.some(row => row.Action === 'RCC_DECISION'));
  assert.deepEqual((await r.get('Baseline', baselineId)).Snapshot, { budget: 1000, physicalPct: 20 });
});
