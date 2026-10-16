import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLossRule, evaluatePaymentDelayLoss, detectCostOverlaps, summarizeLossPortfolio, LOSS_CATEGORIES } from './claimLossLogic.js';
import { extractFromDocumentText, suggestLossCategory, buildLossSuggestions } from './lossAiLogic.js';

const approvedRule = { Code: 'R-1', NameFa: 'سربار', Category: 'overhead', Kind: 'rate_qty_period', Version: '1.0', Status: 'approved', SourceFa: 'بند قرارداد' };

test('Loss categories: configurable library covers the 14 mandated classes', () => {
  assert.ok(LOSS_CATEGORIES.length >= 14);
  for (const code of ['site_running_costs', 'overhead', 'payment_delay', 'adjustment_delay', 'change_work', 'labor', 'machinery', 'suspension', 'remobilization', 'site_access_delay', 'approval_delay', 'procurement_extra', 'changed_conditions', 'other']) {
    assert.ok(LOSS_CATEGORIES.some(c => c.code === code), code);
  }
});

test('ClaimLossCalculationEngine: approved rule computes rate x qty x period and is reproducible', () => {
  const a = evaluateLossRule(approvedRule, { rate: 2_000_000, quantity: 10, periodUnits: 20 });
  const b = evaluateLossRule(approvedRule, { rate: 2_000_000, quantity: 10, periodUnits: 20 });
  assert.equal(a.status, 'calculated');
  assert.equal(a.finalAmount, 400_000_000);
  assert.deepEqual(a, b); // بازتولید نتیجهٔ یکسان با ورودی یکسان
  assert.equal(a.ruleVersion, '1.0');
});

test('Engine: unapproved rule never yields a final amount', () => {
  for (const status of ['draft', 'needs_review', 'obsolete', 'inactive']) {
    const r = evaluateLossRule({ ...approvedRule, Status: status }, { rate: 1, quantity: 1, periodUnits: 1 });
    assert.equal(r.status, 'needs_review', status);
    assert.equal(r.finalAmount, null, status);
  }
});

test('Engine: invalid inputs are rejected (negative, missing, period, currency)', () => {
  assert.equal(evaluateLossRule(approvedRule, { rate: -1, quantity: 1, periodUnits: 1 }).status, 'needs_review');
  assert.equal(evaluateLossRule(approvedRule, { rate: 1 }).status, 'needs_review');
  assert.equal(evaluateLossRule(approvedRule, { rate: 1, quantity: 1, periodUnits: 1, periodFrom: '2026-02-01', periodTo: '2026-01-01' }).status, 'needs_review');
  assert.equal(evaluateLossRule(approvedRule, { rate: 1, quantity: 1, periodUnits: 1, currency: 'USD' }, { itemCurrency: 'IRR' }).status, 'needs_review');
  assert.equal(evaluateLossRule({ ...approvedRule, Kind: 'amount_pct' }, { baseAmount: 1000, pct: 150 }).status, 'needs_review');
});

test('Engine: manual adjustment requires reason and user identity and is recorded', () => {
  assert.equal(evaluateLossRule(approvedRule, { rate: 10, quantity: 1, periodUnits: 1 }, { manualAdjustment: 5 }).status, 'needs_review');
  const ok = evaluateLossRule(approvedRule, { rate: 10, quantity: 1, periodUnits: 1 }, { manualAdjustment: 5, manualReason: 'اصلاح کارشناسی', manualBy: 'u-client' });
  assert.equal(ok.status, 'calculated');
  assert.equal(ok.finalAmount, 15);
  assert.equal(ok.manualAdjustment, 5);
  assert.equal(ok.manualBy, 'u-client');
});

test('PaymentDelayLossEngine: delay without an approved financial basis yields time only, never an amount', () => {
  const noBasis = evaluatePaymentDelayLoss({ delayDays: 20.35, financialRule: null });
  assert.equal(noBasis.status, 'needs_review');
  assert.equal(noBasis.delayDays, 20.35);
  assert.equal(noBasis.amount, null);
  const basis = evaluatePaymentDelayLoss({ delayDays: 10, financialRule: { ...approvedRule, Kind: 'daily_rate_days' }, dailyRate: 3_000_000 });
  assert.equal(basis.status, 'calculated');
  assert.equal(basis.amount, 30_000_000);
});

test('Overlap control: duplicate document, same amount+period, overhead overlap, allocation ceiling', () => {
  const items = [
    { Id: 'i1', Amount: 100, PeriodFrom: '2026-01-01', PeriodTo: '2026-01-31', DocumentRefs: ['doc-1'], CostNature: 'indirect', LossCategory: 'overhead' },
    { Id: 'i2', Amount: 100, PeriodFrom: '2026-01-15', PeriodTo: '2026-02-15', DocumentRefs: ['doc-1'], CostNature: 'indirect', LossCategory: 'overhead' },
  ];
  const kinds = detectCostOverlaps(items, [
    { ClaimCostItemId: 'i1', DelayEventId: 'e1', AllocationPct: 70 },
    { ClaimCostItemId: 'i1', DelayEventId: 'e2', AllocationPct: 50 },
  ]).map(w => w.kind);
  assert.ok(kinds.includes('duplicate_document'));
  assert.ok(kinds.includes('duplicate_amount_period'));
  assert.ok(kinds.includes('overhead_overlap'));
  assert.ok(kinds.includes('allocation_over_100'));
});

test('Loss AI assist: extraction finds amounts/dates/statement numbers without inventing values', () => {
  const x = extractFromDocumentText('صورت وضعیت شماره ۷ به مبلغ 12,500,000,000 ریال در تاریخ 1405/05/10 تسلیم شد و قرارداد C-100 پرداخت گردید.');
  assert.ok(x.amounts.some(a => a.value === 12500000000));
  assert.ok(x.dates.includes('1405/05/10'));
  assert.ok(x.statementNos.includes('7'));
  assert.equal(extractFromDocumentText('متن بدون عدد').amounts.length, 0);
});

test('Loss AI assist: category suggestion and completeness/date checks are advisory only', () => {
  assert.equal(suggestLossCategory('تمدید ضمانت‌نامه انجام تعهدات')?.code, 'guarantee_extension');
  const out = buildLossSuggestions({
    claim: { Code: 'C-9', TitleFa: 'پرونده آزمون', Clause: 'ماده ۵۰', Entitlement: '', Causation: '' },
    costItems: [{ Id: 'i1', TitleFa: 'سربار کارگاه', LossCategory: 'overhead', Basis: '', DocumentRefs: [], PeriodFrom: '2025-12-01', PeriodTo: '2026-03-01', DelayEventId: 'e1', Amount: 10 }],
    delayEvents: [{ Id: 'e1', Code: 'D-1', StartDate: '2026-01-01', FinishDate: '2026-01-31' }],
    runs: [], allocations: [], documents: [],
    documentText: 'مبلغ 5,000 ریال',
  });
  assert.equal(out.provider, 'rule');
  assert.equal(out.llmConnected, false);
  const kinds = out.suggestions.map(s => s.kind);
  assert.ok(kinds.includes('missing_document'));
  assert.ok(kinds.includes('missing_basis'));
  assert.ok(kinds.includes('date_contradiction'));
  assert.ok(kinds.includes('extraction'));
  assert.ok(out.suggestions.every(s => s.needsExpertReview === true));
  assert.ok(out.draftDescriptionFa.includes('پیش‌نویس'));
});

test('Portfolio summary keeps estimated/calculated/documented/proposed/approved strictly separate', () => {
  const summary = summarizeLossPortfolio(
    [{ Code: 'C-1', Amount: 1000, ProposedAmount: 800, DeterminedAmount: 600, SettlementAmount: null }],
    [{ Id: 'i1', ClaimCode: 'C-1', Amount: 500, DocumentedAmount: 450, ApprovedAmount: 400, DocumentRefs: ['doc-1'] }, { Id: 'i2', ClaimCode: 'C-1', Amount: 100, DocumentRefs: [] }],
    [{ ClaimCostItemId: 'i1', FinalAmount: 480, CalculatedAt: '2026-01-02', Status: 'calculated' }],
    [{ Id: 'v1' }],
  );
  const row = summary.cases.find(c => c.claimCode === 'C-1');
  assert.equal(row.estimated, 1000);
  assert.equal(row.calculated, 480);
  assert.equal(row.documented, 450);
  assert.equal(row.proposed, 800);
  assert.equal(row.approvedInternal, 400);
  assert.equal(row.accepted, 600);
  assert.equal(row.finalDetermined, null);
  assert.equal(row.itemsWithoutDocs, 1);
  assert.equal(summary.documentVersions, 1);
});
