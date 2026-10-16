import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRcc, noticeState, summarizeNotices, riskReserveState, summarizeReserves, riskReviewPatch, issueEws, summarizeIssues, issueTransitionPatch, claimLifecyclePatch, isoDay, changeReady, claimIssues } from './rccWsLogic.js';
import { MIGRATIONS, tableDef } from './sqlLogic.js';
const risk = { Code: 'R1', TitleFa: 'ریسک', Category: 'PM', Owner: 'مالک', Probability: 3, Impact: 4 };
test('LIVE-3: risk score is calculated, actor/status fields are not trusted', () => {
  const r = normalizeRcc('risks', { ...risk, Score: 999, ProjectId: 'other', CreatedBy: 'hack' });
  assert.equal(r.Score, 12); assert.equal(r.ProjectId, undefined); assert.equal(r.CreatedBy, undefined);
});
test('LIVE-3: risk scales and required owner/category reject malformed values', () => {
  for (const over of [{ Probability: 0 }, { Impact: 6 }, { Probability: 2.5 }, { Owner: '' }, { Category: 'bad' }, { Status: 'approved' }, { Impact: '3' }]) assert.throws(() => normalizeRcc('risks', { ...risk, ...over }));
});
test('LIVE-3: strict Gregorian date validation including leap years', () => {
  assert.equal(isoDay('2024-02-29'), '2024-02-29');
  for (const d of ['2026-02-29', '2026-02-31', '2026-13-01', '', '2026-1-1']) assert.throws(() => isoDay(d));
});
test('LIVE-3: notice deadline includes due day; delivered late is still time-barred', () => {
  const r = { EventDate: '2026-09-01', NoticeDays: 28 };
  assert.equal(noticeState(r, '2026-09-29').timeBarred, false);
  assert.equal(noticeState(r, '2026-09-30').timeBarred, true);
  assert.equal(noticeState({ ...r, NoticeDeliveredAt: '2026-09-29T12:00:00Z' }, '2026-10-10').timeBarred, false);
  assert.equal(noticeState({ ...r, NoticeDeliveredAt: '2026-09-30T12:00:00Z' }, '2026-10-10').timeBarred, true);
});
test('LIVE-3: legacy claims without a contractual deadline are unknown, not silently valid', () => {
  assert.equal(noticeState({}, '2026-09-01').timeBarred, null);
  assert.ok(claimIssues({}, '2026-09-01').includes('NoticeDeadline'));
});
test('LIVE-3: approval needs every assessment dimension, not a truthy string', () => {
  assert.equal(changeReady({ Assessment: {} }), false);
  const r = normalizeRcc('changes', { Code: 'C1', TitleFa: 'تغییر', Reason: 'دلیل', CostImpact: -1, TimeImpactDays: -2, Assessment: { Cost: 'true' }, Status: 'approved' });
  assert.equal(r.Status, undefined); assert.equal(r.Assessment.Cost, false);
});
test('LIVE-3: malformed amounts and blank legal basis fail validation', () => {
  assert.throws(() => normalizeRcc('changes', { Code: 'C1', TitleFa: 'تغییر', Reason: 'دلیل', CostImpact: Infinity, TimeImpactDays: 2, Assessment: {} }));
  assert.throws(() => normalizeRcc('claims', { Code: 'X', TitleFa: 'ادعا', EventDate: '2026-09-01', NoticeDays: 0, Amount: 0, ExtensionDays: 0 }));
});
test('LIVE-3: migration 0036 covers all extended RCC columns', () => {
  const m = MIGRATIONS.find(m => m.version === '0036'); assert.ok(m);
  for (const [table, col] of [['Risk', 'Cause'], ['ChangeRequest', 'Assessment'], ['Claim', 'NoticeDeliveredAt'], ['Claim', 'BaselineId']]) {
    assert.ok(tableDef(table).columns.some(c => c.name === col)); assert.ok(m.statements.some(s => s.includes(table) && s.includes(col)));
  }
});
test('LIVE-3: notice summary separates overdue, urgent, delivered and unknown deadlines', () => {
  const rows = [
    { Status: 'draft', EventDate: '2026-09-01', NoticeDays: 10 },
    { Status: 'draft', EventDate: '2026-09-25', NoticeDays: 10 },
    { Status: 'submitted', EventDate: '2026-09-01', NoticeDays: 28, NoticeDeliveredAt: '2026-09-20T00:00:00.000Z' },
    { Status: 'draft' },
    { Status: 'closed', EventDate: '2026-09-01', NoticeDays: 1 },
  ];
  const s = summarizeNotices(rows, '2026-09-28');
  assert.deepEqual(s, { total: 4, delivered: 1, timeBarred: 1, overdue: 1, dueWithin7Days: 1, dueWithin30Days: 0, unknownDeadline: 1, nextDueAt: '2026-09-11' });
});
test('LIVE-3: claim lifecycle validates transitions, notes and value caps', () => {
  const row = { Status: 'under_review', Amount: 100, ExtensionDays: 10 };
  const determined = claimLifecyclePatch(row, { action: 'determine', note: 'بررسی شد', amount: 80, days: 6 }, 'u-client', '2026-09-28T00:00:00.000Z');
  assert.equal(determined.Status, 'determined'); assert.equal(determined.DeterminedAmount, 80); assert.equal(determined.DeterminedDays, 6);
  assert.throws(() => claimLifecyclePatch(row, { action: 'determine', note: 'x', amount: 101, days: 6 }, 'u-client', '2026-09-28T00:00:00.000Z'));
  assert.throws(() => claimLifecyclePatch(row, { action: 'settle', note: 'x', amount: 1, days: 1 }, 'u-client', '2026-09-28T00:00:00.000Z'));
  const settled = claimLifecyclePatch({ ...row, Status: 'determined', DeterminedAmount: 80, DeterminedDays: 6 }, { action: 'settle', note: 'توافق شد', amount: 70, days: 5 }, 'u-client', '2026-09-29T00:00:00.000Z');
  assert.equal(settled.Status, 'settled'); assert.equal(settled.SettlementAmount, 70);
});
test('LIVE-3: migration 0062 covers claim lifecycle columns', () => {
  const m = MIGRATIONS.find(m => m.version === '0062'); assert.ok(m);
  for (const col of ['ReviewAt', 'DeterminedAmount', 'SettlementAmount', 'DisputeNote', 'ClosureNote']) {
    assert.ok(tableDef('Claim').columns.some(c => c.name === col)); assert.ok(m.statements.some(s => s.includes('Claim') && s.includes(col)));
  }
});
test('LIVE-3: risk and change keep structured WBS, activity and baseline links', () => {
  const linkedRisk = normalizeRcc('risks', { ...risk, WbsCode: 'WBS-1', ActivityCode: 'ACT-1', BaselineId: 'base-1' });
  assert.equal(linkedRisk.WbsCode, 'WBS-1'); assert.equal(linkedRisk.ActivityCode, 'ACT-1'); assert.equal(linkedRisk.BaselineId, 'base-1');
  const linkedChange = normalizeRcc('changes', { Code: 'C1', TitleFa: 'تغییر', Reason: 'دلیل', CostImpact: 10, TimeImpactDays: 2, Assessment: {}, WbsCode: 'WBS-1', ActivityCode: 'ACT-1', BaselineId: 'base-1', ApplicationStatus: 'applied', AppliedBy: 'hack' });
  assert.equal(linkedChange.BaselineId, 'base-1'); assert.equal(linkedChange.ApplicationStatus, undefined); assert.equal(linkedChange.AppliedBy, undefined);
});
test('LIVE-3: migration 0063 covers WBS and baseline application links', () => {
  const m = MIGRATIONS.find(m => m.version === '0063'); assert.ok(m);
  for (const [table, col] of [['Risk', 'WbsCode'], ['Risk', 'ActivityCode'], ['Risk', 'BaselineId'], ['ChangeRequest', 'WbsCode'], ['ChangeRequest', 'BaselineId'], ['ChangeRequest', 'ApplicationStatus'], ['ChangeRequest', 'AppliedBaselineId'], ['ChangeRequest', 'AppliedAt']]) {
    assert.ok(tableDef(table).columns.some(c => c.name === col)); assert.ok(m.statements.some(s => s.includes(table) && s.includes(col)));
  }
});
test('LIVE-3: reserve monitoring validates consumption and review patches', () => {
  const linkedRisk = normalizeRcc('risks', { ...risk, ReserveAmount: 100, ReserveUsedAmount: 35, NextReviewDate: '2026-10-01' });
  assert.equal(linkedRisk.ReserveStatus, 'allocated');
  assert.equal(riskReserveState(linkedRisk, '2026-09-28').remaining, 65);
  assert.throws(() => normalizeRcc('risks', { ...risk, ReserveAmount: 10, ReserveUsedAmount: 11 }));
  const reviewed = riskReviewPatch(linkedRisk, { note: 'بازبینی شد', nextReviewDate: '2026-10-15', reserveUsedAmount: 100 }, 'u-pm', '2026-09-28T00:00:00.000Z');
  assert.equal(reviewed.ReserveStatus, 'depleted'); assert.equal(reviewed.LastReviewedBy, 'u-pm');
  assert.equal(summarizeReserves([linkedRisk], '2026-09-28').remaining, 65);
});
test('LIVE-3: issue EWS and workflow transitions are deterministic', () => {
  const issue = normalizeRcc('issues', { Code: 'I1', TitleFa: 'مسئله', Owner: 'کارگاه', Severity: 'critical', DueDate: '2026-09-27', RiskCode: 'R1', Status: 'closed' });
  assert.equal(issue.Status, undefined);
  assert.equal(issueEws({ ...issue, Status: 'open' }, '2026-09-28').code, 'EWS-ISS-03');
  assert.equal(summarizeIssues([{ ...issue, Status: 'open' }], '2026-09-28').overdue, 1);
  const started = issueTransitionPatch({ ...issue, Status: 'open' }, { action: 'start' }, 'u-pm', '2026-09-28T00:00:00.000Z');
  assert.equal(started.Status, 'in_progress');
  const escalated = issueTransitionPatch({ ...issue, Status: 'in_progress', EscalationLevel: 0 }, { action: 'escalate', note: 'نیازمند تصمیم' }, 'u-client', '2026-09-28T00:00:00.000Z');
  assert.equal(escalated.EscalationLevel, 1);
  assert.throws(() => issueTransitionPatch({ ...issue, Status: 'open' }, { action: 'close', note: 'x' }, 'u-client', '2026-09-28T00:00:00.000Z'));
});
test('LIVE-3: migration 0064 covers reserve monitoring and the issue table', () => {
  const m = MIGRATIONS.find(m => m.version === '0064'); assert.ok(m);
  for (const col of ['ReserveAmount', 'ReserveUsedAmount', 'NextReviewDate', 'LastReviewedAt', 'MonitoringNote']) {
    assert.ok(tableDef('Risk').columns.some(c => c.name === col)); assert.ok(m.statements.some(s => s.includes('Risk') && s.includes(col)));
  }
  assert.ok(tableDef('RccIssue').columns.some(c => c.name === 'EscalationLevel'));
  assert.ok(m.statements.some(s => s.includes('RccIssue')));
});
