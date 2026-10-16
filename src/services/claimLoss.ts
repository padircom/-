/**
 * موتور محاسبات خسارت و لایحهٔ ضرر و زیان پیمان (PMO-CLAIMS-LOSS-ENGINE-V1.0).
 *
 * اصول الزام‌آور:
 * - هیچ فرمولی بر اساس عنوان دسته حدس زده نمی‌شود؛ فقط قواعد «تأییدشده» با منبع و
 *   نسخهٔ مشخص محاسبهٔ نهایی می‌دهند. قاعدهٔ تأییدنشده => وضعیت «نیازمند بررسی
 *   کارشناسی» و مبلغ نهایی null.
 * - مدت تأخیر/تمدید (روز) و مبلغ خسارت (پول) دو خروجی متفاوت‌اند و هرگز خودکار
 *   معادل هم فرض نمی‌شوند؛ تبدیل روز به مبلغ فقط با قاعدهٔ مالی تأییدشده و نرخ مستند.
 * - مبالغ برآوردی/محاسباتی/مستند/پیشنهادی/تأییدشده/پذیرفته‌شده/نهایی جدا نگه
 *   داشته می‌شوند و بدون سابقه به هم تبدیل نمی‌شوند.
 * - هشدار هم‌پوشانی «نامزد کارشناسی» است، نه اثبات تکراری‌بودن.
 */

export const LOSS_ENGINE_VERSION = 'claim-loss-v1';

export type LossCategory = { code: string; fa: string; en: string };
/** کتابخانهٔ طبقه‌بندی خسارات؛ قابل توسعه از همین فهرست (کد پایدار، عنوان نمایشی). */
export const LOSS_CATEGORIES: LossCategory[] = [
  { code: 'site_running_costs', fa: 'هزینه‌های مستمر کارگاه', en: 'Site running costs' },
  { code: 'overhead', fa: 'هزینه‌های بالاسری و سربار', en: 'Overhead & head office' },
  { code: 'payment_delay', fa: 'خسارات تأخیر پرداخت صورت‌وضعیت', en: 'Late interim payment losses' },
  { code: 'adjustment_delay', fa: 'خسارات تأخیر پرداخت تعدیل', en: 'Late adjustment payment losses' },
  { code: 'change_work', fa: 'هزینه‌های تغییرات و کارهای جدید', en: 'Variations & new works' },
  { code: 'labor', fa: 'هزینه‌های نیروی انسانی', en: 'Labour costs' },
  { code: 'machinery', fa: 'هزینه‌های ماشین‌آلات و تجهیزات', en: 'Plant & equipment costs' },
  { code: 'suspension', fa: 'هزینه‌های توقف و تعلیق', en: 'Suspension & stoppage' },
  { code: 'remobilization', fa: 'تجهیز و برچیدن مجدد کارگاه', en: 'Remobilisation' },
  { code: 'site_access_delay', fa: 'تأخیر در تحویل جبههٔ کار', en: 'Late site access' },
  { code: 'approval_delay', fa: 'تأخیر در ارائه مدارک یا تأییدیه‌ها', en: 'Late documents / approvals' },
  { code: 'procurement_extra', fa: 'هزینه‌های اضافی تأمین و تدارکات', en: 'Extra procurement costs' },
  { code: 'changed_conditions', fa: 'تغییر شرایط اجرایی', en: 'Changed conditions' },
  { code: 'guarantee_extension', fa: 'تمدید ضمانت‌نامه‌ها', en: 'Guarantee extension' },
  { code: 'site_facilities', fa: 'تجهیز و نگهداری کارگاه', en: 'Site facilities' },
  { code: 'other', fa: 'سایر خسارات قراردادی', en: 'Other contractual losses' },
];
export const LOSS_CATEGORY_CODES = LOSS_CATEGORIES.map(c => c.code);
export const lossCategoryFa = (code: unknown): string => LOSS_CATEGORIES.find(c => c.code === String(code ?? ''))?.fa ?? 'سایر خسارات قراردادی';

export const RULE_KINDS = ['rate_qty_period', 'amount_pct', 'daily_rate_days', 'actual_sum'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];
export const RULE_STATUSES = ['draft', 'needs_review', 'approved', 'obsolete', 'inactive'] as const;

export type LossRule = {
  Id?: string; Code: string; NameFa: string; Category: string; Kind: RuleKind | string;
  FormulaFa?: string | null; SourceFa?: string | null; Version?: string | null;
  Status: string; ApprovedBy?: string | null;
};
export type LossInputs = {
  rate?: number; quantity?: number; periodUnits?: number;
  baseAmount?: number; pct?: number; dailyRate?: number; days?: number;
  directAmount?: number; indirectAmount?: number; currency?: string;
  periodFrom?: string; periodTo?: string;
};
export type LossCalcResult = {
  status: 'calculated' | 'needs_review';
  rawAmount: number | null; finalAmount: number | null;
  ruleVersion: string | null; issues: string[];
  manualAdjustment: number; manualReason: string | null; manualBy: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function validateInputs(kind: string, inputs: LossInputs, issues: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const need = (key: keyof LossInputs, fa: string) => {
    const v = num(inputs[key]);
    if (v === null) issues.push(`ورودی «${fa}» لازم است`);
    else if (v < 0) issues.push(`ورودی «${fa}» نمی‌تواند منفی باشد`);
    else out[key] = v;
  };
  if (kind === 'rate_qty_period') { need('rate', 'نرخ'); need('quantity', 'تعداد/مقدار'); need('periodUnits', 'دوره/واحد زمانی'); }
  else if (kind === 'amount_pct') { need('baseAmount', 'مبلغ مبنا'); need('pct', 'درصد'); if (out.pct > 100) issues.push('درصد نمی‌تواند بیش از ۱۰۰ باشد'); }
  else if (kind === 'daily_rate_days') { need('dailyRate', 'نرخ روزانه'); need('days', 'تعداد روز'); }
  else if (kind === 'actual_sum') { need('directAmount', 'هزینهٔ مستقیم'); need('indirectAmount', 'هزینهٔ غیرمستقیم'); }
  else issues.push('نوع فرمول قاعده معتبر نیست');
  if (inputs.periodFrom && inputs.periodTo && inputs.periodTo < inputs.periodFrom) issues.push('پایان دوره قبل از آغاز آن است');
  return out;
}

function computeRaw(kind: string, v: Record<string, number>): number {
  if (kind === 'rate_qty_period') return v.rate * v.quantity * v.periodUnits;
  if (kind === 'amount_pct') return v.baseAmount * v.pct / 100;
  if (kind === 'daily_rate_days') return v.dailyRate * v.days;
  return v.directAmount + v.indirectAmount; // actual_sum
}

/** ClaimLossCalculationEngine — اجرای یک قاعده روی ورودی‌ها؛ بازتولیدپذیر و نسخه‌دار. */
export function evaluateLossRule(rule: LossRule, inputs: LossInputs, opts?: { manualAdjustment?: number; manualReason?: string; manualBy?: string; itemCurrency?: string }): LossCalcResult {
  const issues: string[] = [];
  const adj = num(opts?.manualAdjustment) ?? 0;
  const manualReason = (opts?.manualReason ?? '').trim() || null;
  const manualBy = (opts?.manualBy ?? '').trim() || null;
  if (adj !== 0 && (!manualReason || !manualBy)) issues.push('اصلاح دستی فقط با دلیل و هویت کاربر مجاز است');
  if (!rule || !rule.Code) issues.push('قاعدهٔ محاسبه مشخص نیست');
  if (rule && rule.Status !== 'approved') issues.push('قاعده تأیید نشده است؛ نتیجه قطعی صادر نمی‌شود و نیازمند بررسی کارشناسی است');
  if (opts?.itemCurrency && inputs.currency && opts.itemCurrency !== inputs.currency) issues.push('واحد پول ورودی با واحد پول قلم خسارت یکسان نیست');
  const values = rule ? validateInputs(String(rule.Kind), inputs, issues) : {};
  const fatal = issues.some(t => !t.includes('تأیید نشده'));
  if (!rule || rule.Status !== 'approved' || fatal) {
    return { status: 'needs_review', rawAmount: null, finalAmount: null, ruleVersion: rule?.Version ?? null, issues, manualAdjustment: adj, manualReason, manualBy };
  }
  const raw = round2(computeRaw(String(rule.Kind), values));
  return { status: 'calculated', rawAmount: raw, finalAmount: round2(raw + adj), ruleVersion: rule.Version ?? null, issues, manualAdjustment: adj, manualReason, manualBy };
}

/**
 * PaymentDelayLossEngine — ابتدا تأخیر زمانی (از نتیجهٔ تأییدشدهٔ ۵۰۹۰/۱۳۰۰ یا تحلیل
 * زمان‌بندی در ماژول تأخیرات) و فقط با قاعدهٔ مالی تأییدشده، مبلغ. بدون مبنای مالی
 * تأییدشده، مبلغ null می‌ماند؛ نرخ سود/بهره هرگز خودکار اعمال نمی‌شود.
 */
export function evaluatePaymentDelayLoss(input: {
  delayDays: number | null; financialRule?: LossRule | null; dailyRate?: number; currency?: string;
}): { status: 'calculated' | 'needs_review'; delayDays: number | null; amount: number | null; issues: string[] } {
  const issues: string[] = [];
  const delayDays = num(input.delayDays);
  if (delayDays === null || delayDays < 0) issues.push('مدت تأخیر تأییدشده از ماژول تأخیرات لازم است');
  if (!input.financialRule) issues.push('مبنای مالی تأییدشده وجود ندارد؛ صرف تأخیر پرداخت مجوز محاسبهٔ مبلغ خسارت نیست');
  else if (input.financialRule.Status !== 'approved') issues.push('قاعدهٔ مالی تأیید نشده است؛ مبلغ قطعی صادر نمی‌شود');
  if (delayDays === null || !input.financialRule || input.financialRule.Status !== 'approved') {
    return { status: 'needs_review', delayDays, amount: null, issues };
  }
  const result = evaluateLossRule(input.financialRule, { dailyRate: input.dailyRate, days: delayDays, currency: input.currency });
  return { status: result.status, delayDays, amount: result.finalAmount, issues: [...issues, ...result.issues] };
}

export type OverlapWarning = { kind: 'duplicate_document' | 'duplicate_amount_period' | 'allocation_over_100' | 'shared_cost' | 'overhead_overlap'; severity: 'violation' | 'warning'; itemIds: string[]; messageFa: string };

function periodsOverlap(aFrom?: string | null, aTo?: string | null, bFrom?: string | null, bTo?: string | null): boolean {
  if (!aFrom || !bFrom) return false;
  const aEnd = aTo ?? aFrom, bEnd = bTo ?? bFrom;
  return aFrom <= bEnd && bFrom <= aEnd;
}

/** کنترل هم‌پوشانی: خروجی «نامزد بررسی کارشناسی» است، نه حکم تکراری‌بودن. */
export function detectCostOverlaps(items: Record<string, unknown>[], allocations: Record<string, unknown>[] = []): OverlapWarning[] {
  const out: OverlapWarning[] = [];
  const docUse = new Map<string, string[]>();
  for (const item of items) {
    for (const ref of (Array.isArray(item.DocumentRefs) ? item.DocumentRefs : [])) {
      const list = docUse.get(String(ref)) ?? []; list.push(String(item.Id)); docUse.set(String(ref), list);
    }
  }
  for (const [ref, ids] of docUse) if (ids.length > 1) out.push({ kind: 'duplicate_document', severity: 'warning', itemIds: [...new Set(ids)], messageFa: `سند «${ref}» در چند قلم خسارت استفاده شده است؛ بررسی کارشناسی لازم است (اثبات تکراری‌بودن نیست)` });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    const sameAmount = Number(a.Amount) > 0 && Number(a.Amount) === Number(b.Amount);
    if (sameAmount && periodsOverlap(a.PeriodFrom as string, a.PeriodTo as string, b.PeriodFrom as string, b.PeriodTo as string)) {
      out.push({ kind: 'duplicate_amount_period', severity: 'warning', itemIds: [String(a.Id), String(b.Id)], messageFa: 'دو قلم با مبلغ یکسان و دورهٔ هم‌پوشان ثبت شده‌اند؛ نامزد بررسی تکراری‌بودن (شباهت مبلغ/تاریخ به‌تنهایی کافی نیست)' });
    }
    const aIndirect = a.CostNature === 'indirect' || a.LossCategory === 'overhead' || a.CostType === 'overhead';
    const bIndirect = b.CostNature === 'indirect' || b.LossCategory === 'overhead' || b.CostType === 'overhead';
    if (aIndirect && bIndirect && periodsOverlap(a.PeriodFrom as string, a.PeriodTo as string, b.PeriodFrom as string, b.PeriodTo as string)) {
      out.push({ kind: 'overhead_overlap', severity: 'warning', itemIds: [String(a.Id), String(b.Id)], messageFa: 'هم‌پوشانی دوره‌ای اقلام بالاسری/غیرمستقیم؛ احتمال پوشش دوبارهٔ سربار بررسی شود' });
    }
  }
  const byItem = new Map<string, number>();
  const eventsByItem = new Map<string, Set<string>>();
  for (const al of allocations) {
    const id = String(al.ClaimCostItemId); byItem.set(id, (byItem.get(id) ?? 0) + (Number(al.AllocationPct) || 0));
    const set = eventsByItem.get(id) ?? new Set<string>(); set.add(String(al.DelayEventId)); eventsByItem.set(id, set);
  }
  for (const [id, total] of byItem) {
    if (total > 100.0001) out.push({ kind: 'allocation_over_100', severity: 'violation', itemIds: [id], messageFa: `مجموع تخصیص قلم از ۱۰۰٪ گذشته است (${Math.round(total * 100) / 100}٪)؛ بدون روش تخصیص مستند مجاز نیست` });
    else if ((eventsByItem.get(id)?.size ?? 0) > 1) out.push({ kind: 'shared_cost', severity: 'warning', itemIds: [id], messageFa: 'هزینه بین چند رویداد مشترک تخصیص یافته است؛ مبنای تخصیص باید مستند باشد' });
  }
  return out;
}

export type LossCaseAmounts = { claimCode: string; estimated: number; calculated: number; documented: number; proposed: number; approvedInternal: number; accepted: number | null; finalDetermined: number | null; itemsCount: number; itemsWithoutDocs: number; itemsNeedingReview: number; readyForDocument: boolean };
export type LossSummary = {
  totals: { estimated: number; calculated: number; documented: number; proposed: number; approvedInternal: number };
  cases: LossCaseAmounts[]; activeCases: number; incompleteDocs: number; needsReview: number; readyForDocument: number; pendingApproval: number; documentVersions: number;
};

/** تفکیک مبالغ هر پرونده + شاخص‌های مرکز کنترل؛ همه از دادهٔ واقعی، بدون عدد ثابت. */
export function summarizeLossPortfolio(claims: Record<string, unknown>[], items: Record<string, unknown>[], runs: Record<string, unknown>[], versions: Record<string, unknown>[] = []): LossSummary {
  const latestRunByItem = new Map<string, Record<string, unknown>>();
  for (const run of [...runs].sort((a, b) => String(a.CalculatedAt ?? '').localeCompare(String(b.CalculatedAt ?? '')))) latestRunByItem.set(String(run.ClaimCostItemId), run);
  const byClaim = new Map<string, LossCaseAmounts>();
  const ensure = (code: string) => { if (!byClaim.has(code)) byClaim.set(code, { claimCode: code, estimated: 0, calculated: 0, documented: 0, proposed: 0, approvedInternal: 0, accepted: null, finalDetermined: null, itemsCount: 0, itemsWithoutDocs: 0, itemsNeedingReview: 0, readyForDocument: false }); return byClaim.get(code)!; };
  for (const claim of claims) {
    const row = ensure(String(claim.Code ?? ''));
    row.estimated += Number(claim.Amount) || 0;
    row.proposed += Number(claim.ProposedAmount) || 0;
    row.accepted = claim.DeterminedAmount === null || claim.DeterminedAmount === undefined ? row.accepted : Number(claim.DeterminedAmount);
    row.finalDetermined = claim.SettlementAmount === null || claim.SettlementAmount === undefined ? row.finalDetermined : Number(claim.SettlementAmount);
  }
  for (const item of items) {
    const code = String(item.ClaimCode ?? ''); if (!code) continue;
    const row = ensure(code);
    row.itemsCount++;
    const run = latestRunByItem.get(String(item.Id));
    const calculated = run && run.FinalAmount !== null && run.FinalAmount !== undefined ? Number(run.FinalAmount) : null;
    if (calculated !== null && Number.isFinite(calculated)) row.calculated += calculated; else row.itemsNeedingReview++;
    row.documented += Number(item.DocumentedAmount ?? (Array.isArray(item.DocumentRefs) && item.DocumentRefs.length ? item.Amount : 0)) || 0;
    row.approvedInternal += Number(item.ApprovedAmount) || 0;
    if (!Array.isArray(item.DocumentRefs) || !item.DocumentRefs.length) row.itemsWithoutDocs++;
  }
  const cases = [...byClaim.values()].map(row => ({ ...row, readyForDocument: row.itemsCount > 0 && row.itemsNeedingReview === 0 }));
  const totals = cases.reduce((acc, c) => ({ estimated: acc.estimated + c.estimated, calculated: acc.calculated + c.calculated, documented: acc.documented + c.documented, proposed: acc.proposed + c.proposed, approvedInternal: acc.approvedInternal + c.approvedInternal }), { estimated: 0, calculated: 0, documented: 0, proposed: 0, approvedInternal: 0 });
  return {
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round2(v)])) as LossSummary['totals'],
    cases,
    activeCases: claims.filter(c => !['closed', 'withdrawn', 'settled'].includes(String(c.Status ?? ''))).length,
    incompleteDocs: cases.reduce((s, c) => s + c.itemsWithoutDocs, 0),
    needsReview: runs.filter(r => r.Status === 'needs_review').length,
    readyForDocument: cases.filter(c => c.readyForDocument).length,
    pendingApproval: items.filter(i => i.Status === 'submitted').length,
    documentVersions: versions.length,
  };
}
