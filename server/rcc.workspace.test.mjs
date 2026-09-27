import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRcc, noticeState, isoDay, changeReady, claimIssues } from './rccWsLogic.js';
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
