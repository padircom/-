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
const wbsId = prefix + '-wbs';
const wbsCode = prefix + '-WBS';
const activityCode = prefix + '-ACT';
const documentId = prefix + '-document';
const contractId = prefix + '-contract';
const contractCode = prefix + '-CN';
const ipcId = prefix + '-ipc';
const scheduleBaselineId = prefix + '-schedule-baseline';
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
const riskBody = n => ({ Code: prefix + '-r' + n, TitleFa: 'ریسک آزمون', Category: 'CON', Probability: 4, Impact: 5, Owner: 'کارگاه', Cause: 'علت', Event: 'رویداد', Effect: 'اثر', Response: 'اقدام', WbsCode: wbsCode, ActivityCode: activityCode, BaselineId: baselineId });
const dims = Object.fromEntries(['Scope', 'Schedule', 'Cost', 'Quality', 'Risk', 'Resource', 'HSE', 'Contract', 'Interface', 'Commissioning', 'Stakeholder', 'Environment'].map(k => [k, true]));
const changeBody = n => ({ Code: prefix + '-c' + n, TitleFa: 'تغییر آزمون', Reason: 'دلیل', CostImpact: 150, TimeImpactDays: 3, Assessment: dims, WbsCode: wbsCode, ActivityCode: activityCode, BaselineId: baselineId });
const claimBody = n => ({ Code: prefix + '-q' + n, TitleFa: 'ادعای آزمون', EventDate: today, NoticeDays: 28, Clause: 'بند ۲۰', Amount: 200, ExtensionDays: 5, BaselineId: baselineId, DataDate: today, Entitlement: 'استحقاق', Causation: 'سببیت', QuantumNote: 'آنالیز مستند', EvidenceRef: 'DOC-1' });
const issueBody = n => ({ Code: prefix + '-i' + n, TitleFa: 'مسئلهٔ آزمون', Description: 'شرح', Severity: 'high', Owner: 'کارگاه', DueDate: today, RiskCode: prefix + '-r1', WbsCode: wbsCode, ActivityCode: activityCode });
const delayBody = n => ({ Code: prefix + '-d' + n, TitleFa: 'رویداد تأخیر آزمون', Category: 'employer', SourceParty: 'کارفرما', StartDate: today, FinishDate: today, EstimatedDelayDays: 4, IsCritical: true, ClaimCode: prefix + '-q1', RiskCode: prefix + '-r1', IssueCode: prefix + '-i1', WbsCode: wbsCode, ActivityCode: activityCode, BaselineId: baselineId, ClauseRef: 'مادهٔ ۵۰', EvidenceRef: 'DOC-DELAY-1', RootCauseFa: 'تأخیر پرداخت' });
let persistedRisk;
before(async () => {
  releaseRuntimeLock = await lockRuntimeTests();
  // Isolated rows in the mandated runtime directory; no copied sample database.
  await fixtureRepo().create('Baseline', { Id: baselineId, ProjectId: 'c1-p1', Name: prefix, SetAt: new Date().toISOString(), SetBy: 'u-planner', IsCurrent: true, Snapshot: { budget: 1000, physicalPct: 20 } });
  await fixtureRepo().create('WbsNode', { Id: wbsId, ProjectId: 'c1-p1', Code: wbsCode, NameFa: 'گره آزمون', ParentId: null, Level: 1, Weight: 100 });
  await fixtureRepo().create('Activity', { Id: prefix + '-activity', ProjectId: 'c1-p1', WbsId: wbsId, Code: activityCode, NameFa: 'فعالیت آزمون', Discipline: 'civil', PlannedStart: today, PlannedFinish: today, DurationDays: 1, PhysicalPct: 0, IsCritical: false, BudgetCost: 100 });
  await fixtureRepo().create('Document', { Id: documentId, ProjectId: 'c1-p1', DocNo: prefix + '-DOC', TitleFa: 'سند آزمون تأخیر', Revision: 'R0', Status: 'issued' });
  await fixtureRepo().create('ContractMaster', { Id: contractId, ProjectId: 'c1-p1', Code: contractCode, TitleFa: 'پیمان آزمون تأخیر', ContractType: 'unit_price', Party: 'main', EmployerName: 'کارفرما', ContractorName: 'پیمانکار', SignDate: '2026-01-01', StartDate: '2026-01-01', DurationDays: 200, InitialAmount: 10000, CurrentAmount: 10000, Currency: 'IRR', CeilingPct: 25, RetainagePct: 10, AdjustmentEnabled: false, ReviewDaysConsultant: 4, ReviewDaysEmployer: 6, Status: 'active' });
  await fixtureRepo().create('InterimPaymentCertificate', { Id: ipcId, ProjectId: 'c1-p1', ContractId: contractId, SerialNo: 7, IpcType: 'interim', PeriodCode: '2026-01', PeriodFrom: '2026-01-01', PeriodTo: '2026-02-19', GrossCurrent: 1000, GrossCumulative: 1000, SubtotalAmount: 1000, TotalDeductions: 0, NetPayable: 1000, WorkflowState: 'paid', SubmittedAt: '2026-01-01', PaidAt: '2026-01-21', PostedToFin: true, Status: 'closed' });
  await fixtureRepo().create('Baseline', { Id: scheduleBaselineId, ProjectId: 'c1-p1', Name: prefix + '-schedule', SetAt: new Date().toISOString(), SetBy: 'u-planner', IsCurrent: false, Snapshot: { activities: [{ id: 'SNAP-A', nameFa: 'مبنای A', duration: 2 }, { id: 'SNAP-B', nameFa: 'مبنای B', duration: 3 }], relations: [{ pred: 'SNAP-A', succ: 'SNAP-B', type: 'FS', lag: 0 }] } });
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
  for (const table of ['Risk', 'ChangeRequest', 'Claim', 'RccIssue', 'DelayEvent', 'DelayCalculation', 'ClaimCostItem', 'AuditLog', 'Baseline', 'WbsNode', 'Activity', 'Document', 'ContractMaster', 'InterimPaymentCertificate']) {
    for (const row of await r.list(table)) if (String(row.Code ?? row.ClaimCode ?? row.DocNo ?? row.Name ?? row.Details?.code ?? row.Id ?? '').startsWith(prefix)) await r.remove(table, row.Id);
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
  for (const table of ['Risk', 'ChangeRequest', 'Claim', 'RccIssue']) {
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
test('LIVE-3 REST: WBS activity baseline links validate and approved change applies to a new baseline revision', async () => {
  const w = await ws('u-pm');
  assert.ok(w.planningRefs.wbs.some(row => row.code === wbsCode));
  assert.ok(w.planningRefs.activities.some(row => row.code === activityCode && row.wbsCode === wbsCode));
  assert.ok(w.planningRefs.baselines.some(row => row.id === baselineId && row.isCurrent));
  assert.equal((await call('/risks', 'u-pm', 'POST', { ...riskBody(8), WbsCode: prefix + '-missing' })).status, 400);
  assert.equal((await call('/risks', 'u-pm', 'POST', { ...riskBody(9), BaselineId: prefix + '-foreign-baseline' })).status, 400);

  const c = await create('changes', changeBody(4), 'u-pm');
  assert.equal(c.WbsCode, wbsCode); assert.equal(c.ActivityCode, activityCode); assert.equal(c.BaselineId, baselineId); assert.equal(c.ApplicationStatus, 'not_applied');
  const approved = await call(`/changes/${c.Id}/decision`, 'u-client', 'POST', { decision: 'approved', reason: 'تأیید کمیته', RowVersion: c.RowVersion });
  assert.equal(approved.status, 200, JSON.stringify(approved));
  assert.equal((await call(`/changes/${c.Id}/apply`, 'u-pm', 'POST', { note: 'اعمال', RowVersion: 2 })).status, 403);
  const applied = await call(`/changes/${c.Id}/apply`, 'u-client', 'POST', { note: 'نسخهٔ اصلاحی برنامه صادر شد', RowVersion: 2 });
  assert.equal(applied.status, 200, JSON.stringify(applied));
  assert.equal(applied.body.data.change.ApplicationStatus, 'applied');
  assert.equal(applied.body.data.baseline.IsCurrent, false);
  assert.equal(applied.body.data.baseline.Snapshot.appliedChange.changeCode, c.Code);
  assert.equal(applied.body.data.sourceBaselineId, baselineId);
  assert.equal((await call(`/changes/${c.Id}/apply`, 'u-client', 'POST', { note: 'تکرار', RowVersion: 3 })).status, 409);
  const source = await fixtureRepo().get('Baseline', baselineId);
  assert.equal(source.IsCurrent, true); assert.deepEqual(source.Snapshot, { budget: 1000, physicalPct: 20 });
});
test('LIVE-3 REST: reserve review is persisted and issue EWS workflow enforces escalation SoD', async () => {
  const reviewed = await call(`/risks/${persistedRisk.Id}/review`, 'u-pm', 'POST', { note: 'بازبینی ذخیره', nextReviewDate: today, reserveAmount: 100, reserveUsedAmount: 40, RowVersion: persistedRisk.RowVersion });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed));
  assert.equal(reviewed.body.data.ReserveAmount, 100); assert.equal(reviewed.body.data.ReserveUsedAmount, 40); assert.equal(reviewed.body.data.LastReviewedBy, 'u-pm');
  persistedRisk = reviewed.body.data;

  const issue = await create('issues', { ...issueBody(1), Status: 'closed', EscalationLevel: 99 }, 'u-pm');
  assert.equal(issue.Status, 'open'); assert.equal(issue.EscalationLevel, 0); assert.equal(issue.RiskCode, prefix + '-r1');
  assert.equal((await call('/issues', 'u-pm', 'POST', { ...issueBody(2), RiskCode: prefix + '-missing' })).status, 400);
  assert.equal((await call(`/issues/${issue.Id}/transition`, 'u-pm', 'POST', { action: 'escalate', note: 'خودتشدیدی', RowVersion: 1 })).status, 403);
  const started = await call(`/issues/${issue.Id}/transition`, 'u-pm', 'POST', { action: 'start', RowVersion: 1 });
  assert.equal(started.status, 200, JSON.stringify(started)); assert.equal(started.body.data.Status, 'in_progress');
  const escalated = await call(`/issues/${issue.Id}/transition`, 'u-pmo', 'POST', { action: 'escalate', note: 'نیازمند تصمیم مدیریت', RowVersion: 2 });
  assert.equal(escalated.status, 200, JSON.stringify(escalated)); assert.equal(escalated.body.data.EscalationLevel, 1);
  const resolved = await call(`/issues/${issue.Id}/transition`, 'u-pm', 'POST', { action: 'resolve', note: 'رفع شد', RowVersion: 3 });
  assert.equal(resolved.status, 200, JSON.stringify(resolved)); assert.equal(resolved.body.data.Status, 'resolved');
  const closed = await call(`/issues/${issue.Id}/transition`, 'u-pmo', 'POST', { action: 'close', note: 'بسته شد', RowVersion: 4 });
  assert.equal(closed.status, 200, JSON.stringify(closed)); assert.equal(closed.body.data.Status, 'closed');

  const w = await ws('u-pm');
  assert.equal(w.reserveSummary.allocated, 100); assert.equal(w.reserveSummary.remaining, 60);
  assert.equal(w.issues.find(row => row.Id === issue.Id).Status, 'closed');
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
test('LIVE-3 REST: actual notice date, notice summary and full claim lifecycle', async () => {
  const c = await create('claims', claimBody(4), 'u-contracts');
  const notice = await call(`/claims/${c.Id}/notice`, 'u-contracts', 'POST', { NoticeRef: 'NOTICE-4', DeliveredDate: today, RowVersion: 1 });
  assert.equal(notice.status, 200, JSON.stringify(notice));
  assert.equal(notice.body.data.NoticeDate, today);
  assert.equal(notice.body.data.NoticeDeliveredAt.slice(0, 10), today);

  const submitted = await call(`/claims/${c.Id}/submit`, 'u-pm', 'POST', { RowVersion: 2 });
  assert.equal(submitted.status, 200, JSON.stringify(submitted));
  assert.equal((await call(`/claims/${c.Id}/lifecycle`, 'u-pm', 'POST', { action: 'start_review', RowVersion: 3 })).status, 403);

  const review = await call(`/claims/${c.Id}/lifecycle`, 'u-client', 'POST', { action: 'start_review', note: 'بررسی آغاز شد', RowVersion: 3 });
  assert.equal(review.status, 200, JSON.stringify(review)); assert.equal(review.body.data.Status, 'under_review');
  assert.equal((await call(`/claims/${c.Id}/lifecycle`, 'u-client', 'POST', { action: 'determine', note: 'بیش از سقف', amount: 201, days: 5, RowVersion: 4 })).status, 400);
  const determined = await call(`/claims/${c.Id}/lifecycle`, 'u-client', 'POST', { action: 'determine', note: 'مبنای مستند پذیرفته شد', amount: 150, days: 4, RowVersion: 4 });
  assert.equal(determined.status, 200, JSON.stringify(determined)); assert.equal(determined.body.data.Status, 'determined');

  const disputed = await call(`/claims/${c.Id}/lifecycle`, 'u-contracts', 'POST', { action: 'dispute', note: 'به مبلغ تعیین‌شده اعتراض دارم', RowVersion: 5 });
  assert.equal(disputed.status, 200, JSON.stringify(disputed)); assert.equal(disputed.body.data.Status, 'disputed');
  const settled = await call(`/claims/${c.Id}/lifecycle`, 'u-client', 'POST', { action: 'settle', note: 'توافق نهایی', amount: 140, days: 3, RowVersion: 6 });
  assert.equal(settled.status, 200, JSON.stringify(settled)); assert.equal(settled.body.data.Status, 'settled');
  const closed = await call(`/claims/${c.Id}/lifecycle`, 'u-client', 'POST', { action: 'close', note: 'پرونده بسته شد', RowVersion: 7 });
  assert.equal(closed.status, 200, JSON.stringify(closed)); assert.equal(closed.body.data.Status, 'closed');

  const w = await ws('u-client');
  assert.ok(w.noticeSummary); assert.equal(w.claims.find(r => r.Id === c.Id).Status, 'closed');
});
test('LIVE-3 REST: delay event, circular calculations and approval are persistent', async () => {
  const d = await create('delays', delayBody(1), 'u-contracts');
  assert.equal(d.Code, prefix + '-d1');
  const badLink = await call('/delays', 'u-contracts', 'POST', { ...delayBody(2), Code: prefix + '-d2', ClaimCode: prefix + '-missing' });
  assert.equal(badLink.status, 400); assert.equal(badLink.body.error.code, 'RCC_CLAIM_LINK');
  const circular5090 = await call(`/delays/${d.Id}/calculate`, 'u-contracts', 'POST', { engine: 'circular5090', statementKind: 'interim', submittedAt: '2026-01-01', actualPaidAt: '2026-01-21', contractPaymentDays: 10, statementGrossAmount: 1000, statementPeriodDays: 50, initialContractDurationDays: 200, initialContractAmount: 10000, RowVersion: d.RowVersion });
  assert.equal(circular5090.status, 200, JSON.stringify(circular5090));
  assert.equal(circular5090.body.data.Engine, 'circular5090'); assert.equal(circular5090.body.data.Status, 'calculated'); assert.ok(circular5090.body.data.RawValueDays > 0); assert.equal(circular5090.body.data.FinalValueDays, null);
  const forbiddenApprove = await call(`/delay-calculations/${circular5090.body.data.Id}/approve`, 'u-contracts', 'POST', { note: 'تأیید خودم', RowVersion: circular5090.body.data.RowVersion });
  assert.equal(forbiddenApprove.status, 403); assert.equal(forbiddenApprove.body.error.code, 'RCC_FORBIDDEN');
  const approved = await call(`/delay-calculations/${circular5090.body.data.Id}/approve`, 'u-client', 'POST', { note: 'قاعده و شواهد بررسی شد', RowVersion: circular5090.body.data.RowVersion });
  assert.equal(approved.status, 200, JSON.stringify(approved)); assert.equal(approved.body.data.Status, 'approved'); assert.ok(approved.body.data.FinalValueDays > 0);
  const circular1300 = await call(`/delays/${d.Id}/calculate`, 'u-contracts', 'POST', { engine: 'circular1300', periodDays: 60, article37ExactlyComplied: false, RowVersion: d.RowVersion });
  assert.equal(circular1300.status, 200, JSON.stringify(circular1300)); assert.equal(circular1300.body.data.RawValueDays, 40); assert.equal(circular1300.body.data.FinalValueDays, null);
  const w = await ws();
  assert.ok(w.delays.some(row => row.Id === d.Id)); assert.ok(w.delayCalculations.some(row => row.Id === approved.body.data.Id)); assert.ok((w.delaySummary?.approvedExtensionDays ?? 0) > 0);
});
test('LIVE-3 REST: delay EDMS links, IPC derivation, append-only revisions and no-double-count summary', async () => {
  const badDocument = await call('/delays', 'u-contracts', 'POST', { ...delayBody(3), EvidenceRefs: ['missing-document'] });
  assert.equal(badDocument.status, 400); assert.equal(badDocument.body.error.code, 'RCC_DOCUMENT_LINK');
  const linked = await create('delays', { ...delayBody(3), Status: 'accepted', ContractCode: contractCode, IpcId: ipcId, EvidenceRefs: [documentId] }, 'u-contracts');
  assert.equal(linked.Status, 'under_review');
  assert.deepEqual(linked.EvidenceRefs, [documentId]);
  const workspaceBefore = await ws();
  assert.ok(workspaceBefore.documentRefs.some(row => row.id === documentId));
  assert.ok(workspaceBefore.financialRefs.ipcs.some(row => row.id === ipcId && row.contractCode === contractCode));

  const derived5090 = await call(`/delays/${linked.Id}/calculate`, 'u-contracts', 'POST', { engine: 'circular5090', RowVersion: linked.RowVersion });
  assert.equal(derived5090.status, 200, JSON.stringify(derived5090));
  assert.ok(derived5090.body.data.RawValueDays > 2.7 && derived5090.body.data.RawValueDays < 2.8);
  assert.equal(derived5090.body.data.FinalValueDays, null);
  const spoofed1300 = await call(`/delays/${linked.Id}/calculate`, 'u-contracts', 'POST', { engine: 'circular1300', periodDays: 60, ruleStatus: 'approved', RowVersion: linked.RowVersion });
  assert.equal(spoofed1300.status, 200, JSON.stringify(spoofed1300));
  assert.equal(spoofed1300.body.data.FinalValueDays, null);
  assert.notEqual(spoofed1300.body.data.Id, derived5090.body.data.Id);
  const missingArticle37 = await call(`/delays/${linked.Id}/calculate`, 'u-contracts', 'POST', { engine: 'circular1300', periodDays: 60, RowVersion: linked.RowVersion });
  assert.equal(missingArticle37.body.data.RawValueDays, null);

  const revised5090 = await call(`/delays/${linked.Id}/calculate`, 'u-contracts', 'POST', { engine: 'circular5090', statementGrossAmount: 2000, RowVersion: linked.RowVersion });
  assert.equal(revised5090.status, 200, JSON.stringify(revised5090));
  assert.notEqual(revised5090.body.data.Id, derived5090.body.data.Id);
  const approvedDerived = await call(`/delay-calculations/${derived5090.body.data.Id}/approve`, 'u-client', 'POST', { note: 'بازبینی اول', RowVersion: derived5090.body.data.RowVersion });
  assert.equal(approvedDerived.status, 200, JSON.stringify(approvedDerived));
  const approvedRevision = await call(`/delay-calculations/${revised5090.body.data.Id}/approve`, 'u-client', 'POST', { note: 'بازبینی دوم جایگزین اول است', RowVersion: revised5090.body.data.RowVersion });
  assert.equal(approvedRevision.status, 200, JSON.stringify(approvedRevision));
  const approved1300 = await call(`/delay-calculations/${spoofed1300.body.data.Id}/approve`, 'u-client', 'POST', { note: 'مدت مجاز پرداخت بررسی شد', RowVersion: spoofed1300.body.data.RowVersion });
  assert.equal(approved1300.status, 200, JSON.stringify(approved1300));

  const after = await ws();
  const eventCalculations = after.delayCalculations.filter(row => row.DelayEventId === linked.Id);
  assert.ok(eventCalculations.length >= 4);
  assert.equal(eventCalculations.find(row => row.Id === derived5090.body.data.Id).Status, 'approved');
  // فقط آخرین بازبینی ۵۰۹۰ همین IPC شمرده می‌شود و ۴۰ روز ۱۳۰۰ وارد تمدید نمی‌شود.
  assert.ok(Math.abs((after.delaySummary?.approvedExtensionDays ?? 0) - (2.788 + approvedRevision.body.data.FinalValueDays)) < 0.001, JSON.stringify(after.delaySummary));

  const currentLinked = after.delays.find(row => row.Id === linked.Id);
  const reviewed = await call(`/delays/${linked.Id}/review`, 'u-pm', 'POST', { reviewStatus: 'accepted', note: 'رویداد و مستندات پذیرفته شد', RowVersion: currentLinked.RowVersion });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed));
  assert.equal(reviewed.body.data.Status, 'accepted');
});
test('LIVE-3 REST: monetary claim cost items persist with EDMS links and deadline alerts notify once', async () => {
  const w0 = await ws();
  const event = w0.delays[0];
  assert.ok(event);
  const badDoc = await call(`/delays/${event.Id}/cost-items`, 'u-contracts', 'POST', { CostType: 'overhead', TitleFa: 'سربار', Amount: 100, DocumentRefs: ['missing-doc'] });
  assert.equal(badDoc.status, 400); assert.equal(badDoc.body.error.code, 'RCC_DOCUMENT_LINK');
  const badType = await call(`/delays/${event.Id}/cost-items`, 'u-contracts', 'POST', { CostType: 'unknown_type', TitleFa: 'x', Amount: 1 });
  assert.equal(badType.status, 400);
  const created = await call(`/delays/${event.Id}/cost-items`, 'u-contracts', 'POST', { CostType: 'guarantee_extension', TitleFa: 'تمدید ضمانت‌نامه', Amount: 500, Currency: 'IRR', Basis: 'کارمزد بانکی', PeriodFrom: '2026-01-01', PeriodTo: '2026-02-01', DocumentRefs: [documentId] });
  assert.equal(created.status, 201, JSON.stringify(created));
  assert.equal(created.body.data.ClaimCode, event.ClaimCode);
  const w1 = await ws();
  assert.ok(w1.claimCostItems.some(row => row.Id === created.body.data.Id));
  assert.ok((w1.monetarySummary?.totalAmount ?? 0) >= 500);
  assert.ok(Array.isArray(w1.deadlineAlerts));

  const notify1 = await call('/deadline-alerts/notify', 'u-pm', 'POST', { withinDays: 30 });
  assert.equal(notify1.status, 200, JSON.stringify(notify1));
  const createdCount = notify1.body.data.created;
  const notify2 = await call('/deadline-alerts/notify', 'u-pm', 'POST', { withinDays: 30 });
  assert.equal(notify2.status, 200);
  assert.equal(notify2.body.data.created, 0);
  assert.ok(createdCount >= 0);

  const removed = await call(`/cost-items/${created.body.data.Id}`, 'u-contracts', 'DELETE');
  assert.equal(removed.status, 200, JSON.stringify(removed));
  const w2 = await ws();
  assert.ok(!w2.claimCostItems.some(row => row.Id === created.body.data.Id));
});
test('LOSS-V1 REST: rule lifecycle, append-only calculation runs, allocation ceiling and versioned loss document', async () => {
  const w0 = await ws();
  const event = w0.delays[0]; assert.ok(event);
  const item = await call(`/delays/${event.Id}/cost-items`, 'u-contracts', 'POST', { CostType: 'overhead', TitleFa: 'سربار آزمون خسارت', Amount: 0, Currency: 'IRR', DocumentedAmount: 380, ApprovedAmount: 350, CostNature: 'indirect', PeriodFrom: '2026-01-01', PeriodTo: '2026-01-31', DocumentRefs: [documentId] });
  assert.equal(item.status, 201, JSON.stringify(item));
  const itemId = item.body.data.Id;
  // قاعده بدون منبع قراردادی ثبت نمی‌شود؛ فرمول حدسی ممنوع.
  const noSource = await call('/loss-rules', 'u-contracts', 'POST', { Code: prefix + '-bad', NameFa: 'بدون منبع', Category: 'overhead', Kind: 'rate_qty_period' });
  assert.equal(noSource.status, 400);
  const rule = await call('/loss-rules', 'u-contracts', 'POST', { Code: prefix + '-ovh', NameFa: 'سربار روزانه', Category: 'overhead', Kind: 'rate_qty_period', FormulaFa: 'نرخ × مقدار × دوره', SourceFa: 'بند آزمون', Version: '1.0' });
  assert.equal(rule.status, 201, JSON.stringify(rule)); assert.equal(rule.body.data.Status, 'needs_review');
  // قاعدهٔ تأییدنشده: اجرا ثبت می‌شود ولی مبلغ نهایی ندارد.
  const run0 = await call(`/cost-items/${itemId}/calculate`, 'u-contracts', 'POST', { ruleId: rule.body.data.Id, inputs: { rate: 200, quantity: 10, periodUnits: 20 } });
  assert.equal(run0.status, 201, JSON.stringify(run0)); assert.equal(run0.body.data.Status, 'needs_review'); assert.equal(run0.body.data.FinalAmount, null);
  // تأیید قاعده توسط کارفرما (شخص جدا از سازنده).
  const approvedRule = await call(`/loss-rules/${rule.body.data.Id}/approve`, 'u-client', 'POST', { note: 'قاعده و منبع بررسی شد' });
  assert.equal(approvedRule.status, 200, JSON.stringify(approvedRule));
  const run1 = await call(`/cost-items/${itemId}/calculate`, 'u-contracts', 'POST', { ruleId: rule.body.data.Id, inputs: { rate: 200, quantity: 10, periodUnits: 20 } });
  assert.equal(run1.body.data.Status, 'calculated'); assert.equal(run1.body.data.FinalAmount, 40000);
  // تخصیص بالای ۱۰۰٪ بدون مبنا رد و با مبنای مستند پذیرفته و در کنترل هم‌پوشانی پرچم می‌شود.
  assert.equal((await call(`/cost-items/${itemId}/allocations`, 'u-contracts', 'POST', { DelayEventId: event.Id, AllocationPct: 70 })).status, 201);
  assert.equal((await call(`/cost-items/${itemId}/allocations`, 'u-contracts', 'POST', { DelayEventId: event.Id, AllocationPct: 70 })).status, 422);
  assert.equal((await call(`/cost-items/${itemId}/allocations`, 'u-contracts', 'POST', { DelayEventId: event.Id, AllocationPct: 70, Basis: 'روش تخصیص مستند آزمون' })).status, 201);
  const w1 = await ws();
  assert.ok(w1.overlapWarnings.some(w => w.kind === 'allocation_over_100'));
  assert.ok(w1.lossSummary.cases.some(c => c.calculated >= 40000));
  // لایحهٔ ضرر و زیان: Word واقعی و نسخهٔ پیش‌نویس ماندگار.
  const claim = w1.claims.find(c => c.Code === event.ClaimCode); assert.ok(claim);
  const doc = await fetch(`${BASE}/api/rcc/c1-p1/claims/${claim.Id}/loss-document?format=word`, { headers: { 'x-user-id': 'u-pm' } });
  assert.equal(doc.status, 200);
  const html = await doc.text();
  assert.ok(html.includes('لایحهٔ ضرر و زیان'));
  assert.ok(html.includes('پیش‌نویس'));
  const w2 = await ws();
  assert.ok(w2.lossDocumentVersions.some(v => v.ClaimId === claim.Id && v.Status === 'draft'));
});

test('LIVE-3 REST: schedule TIA alias, explicit Windows snapshots and Baseline snapshot network', async () => {
  const tiaEvent = await create('delays', { ...delayBody(4), EstimatedDelayDays: 4 }, 'u-contracts');
  const tia = await call(`/delays/${tiaEvent.Id}/calculate`, 'u-contracts', 'POST', { engine: 'schedule', method: 'time_impact', dataDate: today, eventDelayDays: 4, RowVersion: tiaEvent.RowVersion });
  assert.equal(tia.status, 200, JSON.stringify(tia));
  assert.equal(tia.body.data.Method, 'time_impact_analysis');
  assert.equal(tia.body.data.Result.status, 'calculated');

  const windowsEvent = await create('delays', { ...delayBody(5), EstimatedDelayDays: 0 }, 'u-contracts');
  const noWindows = await call(`/delays/${windowsEvent.Id}/calculate`, 'u-contracts', 'POST', { engine: 'schedule', method: 'windows', dataDate: '2026-01-01', windows: [], RowVersion: windowsEvent.RowVersion });
  assert.equal(noWindows.body.data.Result.status, 'needs_review');
  const activities = [{ id: activityCode, nameFa: 'فعالیت آزمون', duration: 1 }];
  const withWindows = await call(`/delays/${windowsEvent.Id}/calculate`, 'u-contracts', 'POST', { engine: 'schedule', method: 'windows', dataDate: '2026-01-01', windows: [{ label: 'W1', dataDate: '2026-01-01', baselineActivities: activities, updatedActivities: [{ ...activities[0], duration: 3 }] }], RowVersion: windowsEvent.RowVersion });
  assert.equal(withWindows.status, 200, JSON.stringify(withWindows));
  assert.equal(withWindows.body.data.Result.status, 'calculated');
  assert.equal(withWindows.body.data.Result.windowResults.length, 1);
  assert.ok(withWindows.body.data.RawValueDays > 0);

  const snapshotEvent = await create('delays', { ...delayBody(6), ActivityCode: '', WbsCode: wbsCode, BaselineId: scheduleBaselineId, EstimatedDelayDays: 2 }, 'u-contracts');
  const snapshotCalc = await call(`/delays/${snapshotEvent.Id}/calculate`, 'u-contracts', 'POST', { engine: 'schedule', method: 'impacted_as_planned', dataDate: '2026-01-01', eventActivityIds: ['SNAP-B'], eventDelayDays: 2, RowVersion: snapshotEvent.RowVersion });
  assert.equal(snapshotCalc.status, 200, JSON.stringify(snapshotCalc));
  assert.equal(snapshotCalc.body.data.Result.status, 'calculated');
  assert.equal(snapshotCalc.body.data.Inputs.scheduleSource, 'baseline_snapshot');
  assert.ok(snapshotCalc.body.data.RawValueDays > 0);
});
test('LIVE-3 REST: EOT document requires a linked approved calculation and downloads from server', async () => {
  const w = await ws();
  const claim = w.claims.find(row => row.Code === prefix + '-q1');
  assert.ok(claim);
  const doc = await fetch(`${BASE}/api/rcc/c1-p1/claims/${claim.Id}/eot-document?format=word`, { headers: { 'x-user-id': 'u-pm' } });
  assert.equal(doc.status, 200);
  assert.match(doc.headers.get('content-disposition') ?? '', /attachment/);
  const text = await doc.text();
  assert.match(text, new RegExp(prefix + '-d1'));
  assert.match(text, /EOT|تمدید/);
  const pdfRes = await fetch(`${BASE}/api/rcc/c1-p1/claims/${claim.Id}/eot-document?format=pdf`, { headers: { 'x-user-id': 'u-pm' } });
  assert.equal(pdfRes.status, 200);
  assert.match(pdfRes.headers.get('content-type') ?? '', /application\/pdf/);
  assert.match(pdfRes.headers.get('content-disposition') ?? '', /\.pdf/);
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdfBytes.length > 1000);
  const gated = await call(`/delays`, 'u-contracts', 'POST', { ...delayBody(9), Code: prefix + '-d9', ClaimCode: prefix + '-q3' });
  assert.ok([201, 400].includes(gated.status));
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
