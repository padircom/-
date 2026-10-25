import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuantityChange, normalizeExtraWork, quantityEffect, assertQuantityBase, variationTransition } from './contractVariationLogic.js';
const common = { ReasonFa: 'دستور کار', DocumentRef: 'DOC-1' };
const quantity = { ...common, BoqItemId: 'boq-1', ChangeNo: 1, NewQty: 12 };
const extra = { ...common, Code: 'EW-1', TitleFa: 'کار جدید', Unit: 'متر', Quantity: 2, ProposedRate: 100, AnalysisMethod: 'rate_analysis' };
const base = { RowVersion: 1, ContractQty: 10, UnitRate: 100, PricingBasis: 'unit_price', Status: 'active', RateStatus: 'agreed' };
test('quantity snapshots and signed amount delta are server calculated', () => {
  assert.equal(normalizeQuantityChange(quantity).ChangeNo, 1);
  assert.deepEqual(quantityEffect(base, 12), { PreviousQty: 10, UnitRateSnapshot: 100, BaseRowVersion: 1, DeltaAmount: 200, LineAmount: 1200 });
  assert.equal(quantityEffect(base, 8).DeltaAmount, -200);
  assert.equal(quantityEffect(base, 0).LineAmount, 0);
});
for (const patch of [{ NewQty: -1 }, { NewQty: 1.2345 }, { ChangeNo: 0 }, { ChangeNo: 1.5 }, { DocumentRef: '' }, { ReasonFa: '' }, { NewQty: true }]) {
  test(`invalid quantity ${JSON.stringify(patch)}`, () => assert.throws(() => normalizeQuantityChange({ ...quantity, ...patch }), { status: 422 }));
}
for (const patch of [{ Quantity: 0 }, { ProposedRate: 0 }, { Unit: '' }, { AnalysisMethod: 'unknown' }, { TitleFa: 'x'.repeat(601) }]) {
  test(`invalid extra work ${JSON.stringify(patch)}`, () => assert.throws(() => normalizeExtraWork({ ...extra, ...patch }), { status: 422 }));
}
test('ineligible or unchanged BOQ rejected; stale snapshot cannot apply', () => {
  for (const patch of [{ PricingBasis: 'lump_sum' }, { Status: 'cancelled' }, { RateStatus: 'rate_pending' }]) assert.throws(() => quantityEffect({ ...base, ...patch }, 12), { status: 422 });
  assert.throws(() => quantityEffect(base, 10), { status: 422 });
  const snapshot = quantityEffect(base, 12); assertQuantityBase(snapshot, base);
  assert.throws(() => assertQuantityBase(snapshot, { ...base, RowVersion: 2 }), { status: 409 });
  assert.throws(() => assertQuantityBase(snapshot, { ...base, UnitRate: 101 }), { status: 409 });
});
test('extra workflow uses existing statuses with independent final rate agreement', () => {
  assert.equal(variationTransition('extra', { Status: 'proposed' }, 'submit', 'u-contracts', ''), 'rate_pending');
  const row = { Status: 'rate_pending', CreatedBy: 'u-contracts', SubmittedBy: 'u-contracts' };
  assert.equal(variationTransition('extra', row, 'approve', 'u-pm', 'تأیید'), 'agreed');
  assert.throws(() => variationTransition('extra', row, 'approve', 'u-contracts', 'خودتأیید'), { status: 403 });
  assert.throws(() => variationTransition('extra', { ...row, Status: 'agreed' }, 'approve', 'u-pm', 'تکرار'), { status: 409 });
  assert.throws(() => variationTransition('quantity', { ...row, Status: 'draft' }, 'approve', 'u-pm', 'زودرس'), { status: 409 });
});
test('approval roles separated from BOQ authoring and project scope', async () => {
  const { DEMO_SUBJECTS, evaluate } = await import('./rbacLogic.js');
  const s = id => DEMO_SUBJECTS.find(x => x.id === id);
  assert(evaluate(s('u-pm'), 'cnt.variation.approve', { projectId: 'c1-p1' }).allow);
  for (const id of ['u-contracts', 'u-planner']) assert(!evaluate(s(id), 'cnt.variation.approve', { projectId: 'c1-p1' }).allow);
  assert(!evaluate(s('u-pm'), 'cnt.variation.approve', { projectId: 'c9-p9' }).allow);
});
