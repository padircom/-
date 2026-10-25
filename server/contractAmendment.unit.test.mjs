import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAmendment, amendmentTransition, amendmentTotals } from './contractAmendmentLogic.js';
const fields = { Code: 'A-1', TitleFa: 'الحاقیه', AmendmentType: 'amount', EffectiveDate: '2026-10-25', AmountDelta: 10, DurationDeltaDays: 5, DocumentRef: 'DOC-1' };
test('normalize preserves signed deltas and soft document/change references', () => {
  assert.deepEqual(normalizeAmendment({ ...fields, AmountDelta: -3.57, DurationDeltaDays: -2, LinkedCrCode: 'CR-1' }), { ...fields, AmountDelta: -3.57, DurationDeltaDays: -2, LinkedCrCode: 'CR-1' });
});
for (const patch of [{ DocumentRef: '' }, { EffectiveDate: '2026-02-30' }, { DurationDeltaDays: 1.5 }, { AmountDelta: Infinity }, { AmountDelta: {} }, { AmountDelta: 0 }, { Code: 'x'.repeat(41) }, { AmendmentType: 'x' }, { TitleFa: true }]) {
  test(`reject malformed amendment ${JSON.stringify(patch)}`, () => assert.throws(() => normalizeAmendment({ ...fields, ...patch }), /./));
}
test('workflow immutable after final decision and no direct draft approval', () => {
  assert.equal(amendmentTransition({ Status: 'draft' }, 'submit', 'u-contracts', ''), 'submitted');
  assert.throws(() => amendmentTransition({ Status: 'draft' }, 'approve', 'u-pm', 'ok'), { status: 409 });
  for (const Status of ['approved', 'rejected', 'cancelled']) assert.throws(() => amendmentTransition({ Status }, 'submit', 'u-pm', ''), { status: 409 });
});
test('independent approver and decision explanation required', () => {
  const row = { Status: 'submitted', CreatedBy: 'u-pm', SubmittedBy: 'u-contracts' };
  for (const actor of ['u-pm', 'u-contracts']) assert.throws(() => amendmentTransition(row, 'approve', actor, 'ok'), { status: 403 });
  assert.throws(() => amendmentTransition(row, 'reject', 'u-client', ''), { status: 422 });
  assert.equal(amendmentTransition(row, 'approve', 'u-client', 'تأیید با سند'), 'approved');
  assert.throws(() => amendmentTransition({ Status: 'submitted' }, 'approve', 'u-pm', 'ok'), { status: 403 });
});
test('only approved deltas affect current amount and duration', () => {
  assert.deepEqual(amendmentTotals(100, 30, [{ Status: 'draft', AmountDelta: 900 }, { Status: 'approved', AmountDelta: 10, DurationDeltaDays: 5 }, { Status: 'approved', AmountDelta: -3, DurationDeltaDays: -2 }]), { currentAmount: 107, currentDurationDays: 33 });
  assert.throws(() => amendmentTotals(100, 30, [{ Status: 'approved', AmountDelta: -101 }]), { status: 422 });
  assert.throws(() => amendmentTotals(100, 30, [{ Status: 'approved', DurationDeltaDays: -30 }]), { status: 422 });
});

test('amendment approval permission is separate from authoring and project-scoped', async () => {
  const { DEMO_SUBJECTS, evaluate } = await import('./rbacLogic.js');
  const user = id => DEMO_SUBJECTS.find(u => u.id === id);
  assert(evaluate(user('u-pm'), 'cnt.amendment.approve', { projectId: 'c1-p1' }).allow);
  assert(evaluate(user('u-client'), 'cnt.amendment.approve', { projectId: 'c1-p1' }).allow);
  for (const id of ['u-contracts', 'u-planner']) assert(!evaluate(user(id), 'cnt.amendment.approve', { projectId: 'c1-p1' }).allow);
  assert(!evaluate(user('u-pm'), 'cnt.amendment.approve', { projectId: 'c9-p9' }).allow);
});
