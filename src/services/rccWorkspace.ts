/** LIVE-3: shared validation/calculations. No synthetic schedule or monetary data. */
import { IMPACT_DIMS, RBS } from './rcc';
import { selectApprovedExtensionCalculations } from './delayAnalysis';
export type RccKind = 'risks' | 'changes' | 'claims' | 'issues' | 'delays';
export type RccRow = { Id: string; Code: string; TitleFa: string; Status: string; RowVersion: number; [key: string]: unknown };
export type DelayCalculationRow = { Id: string; DelayEventId: string; Engine: string; RuleVersion: string; Method?: string | null; Inputs: unknown; Result: unknown; Status: string; RawValueDays: number | null; FinalValueDays: number | null; CalculatedBy?: string | null; CalculatedAt?: string | null; ApprovedBy?: string | null; ApprovedAt?: string | null; [key: string]: unknown };
export type RccWorkspace = { projectId: string; today: string; risks: RccRow[]; changes: RccRow[]; claims: RccRow[]; issues: RccRow[]; delays: RccRow[]; delayCalculations: DelayCalculationRow[]; claimCostItems: ClaimCostItemRow[]; lossRules: LossRuleRow[]; lossRuns: LossRunRow[]; costAllocations: CostAllocationRow[]; lossSummary: unknown; overlapWarnings: unknown[]; lossDocumentVersions: Record<string, unknown>[]; claimsHidden: boolean; risksHidden: boolean; changesHidden: boolean; issuesHidden: boolean; delaysHidden: boolean; permissions: string[]; noticeSummary: NoticeSummary | null; reserveSummary: ReserveSummary | null; issueSummary: IssueSummary | null; delaySummary: DelaySummary | null; monetarySummary: MonetarySummary | null; deadlineAlerts: DeadlineAlert[]; planningRefs: PlanningRefs; documentRefs: DocumentRef[]; financialRefs: FinancialRefs };
export type ClaimCostItemRow = { Id: string; DelayEventId: string; ClaimCode?: string | null; CostType: string; TitleFa: string; Amount: number; Currency?: string | null; Basis?: string | null; PeriodFrom?: string | null; PeriodTo?: string | null; DocumentRefs?: string[]; Status: string; LossCategory?: string | null; CostNature?: string | null; Quantity?: number | null; Rate?: number | null; UnitFa?: string | null; DocumentedAmount?: number | null; ApprovedAmount?: number | null; RuleCode?: string | null; ResourceKind?: string | null; ResourceNameFa?: string | null; WorkedUnits?: number | null; IdleUnits?: number | null; RowVersion: number; [key: string]: unknown };
export type LossRuleRow = { Id: string; Code: string; NameFa: string; Category: string; Kind: string; FormulaFa?: string | null; SourceFa?: string | null; Version?: string | null; Status: string; ApprovedBy?: string | null; RowVersion: number; [key: string]: unknown };
export type LossRunRow = { Id: string; ClaimCostItemId: string; RuleCode?: string | null; RuleVersion?: string | null; Status: string; RawAmount?: number | null; FinalAmount?: number | null; CalculatedBy?: string | null; CalculatedAt?: string | null; Inputs?: unknown; Issues?: unknown; RowVersion: number; [key: string]: unknown };
export type CostAllocationRow = { Id: string; ClaimCostItemId: string; DelayEventId: string; AllocationPct: number; Basis?: string | null; RowVersion: number; [key: string]: unknown };
export type MonetarySummary = { items: number; totalAmount: number; byType: Record<string, number> };
export type DeadlineAlert = { claimId: string; claimCode: string; titleFa: string; dueAt: string; daysLeft: number; severity: 'overdue' | 'critical' | 'warning'; owner: string | null };
export const CLAIM_COST_TYPES = ['guarantee_extension', 'site_facilities', 'overhead', 'suspension', 'other', 'site_running_costs', 'payment_delay', 'adjustment_delay', 'change_work', 'labor', 'machinery', 'remobilization', 'site_access_delay', 'approval_delay', 'procurement_extra', 'changed_conditions'] as const;
export type PlanningRefs = { wbs: { code: string; nameFa: string; level: number | null }[]; activities: { code: string; nameFa: string; wbsCode: string | null }[]; baselines: { id: string; name: string; isCurrent: boolean; setAt: string | null }[] };
export type DocumentRef = { id: string; docNo: string; revision: string; titleFa: string; status: string };
export type FinancialRefs = { contracts: { id: string; code: string; titleFa: string }[]; ipcs: { id: string; serialNo: number | null; contractId: string; contractCode: string; periodCode: string; workflowState: string }[] };
export type NoticeSummary = { total: number; delivered: number; timeBarred: number; overdue: number; dueWithin7Days: number; dueWithin30Days: number; unknownDeadline: number; nextDueAt: string | null };
export type ReserveSummary = { allocated: number; used: number; remaining: number; monitored: number; reviewOverdue: number; reviewDueWithin7Days: number; depleted: number; nextReviewAt: string | null };
export type IssueSummary = { total: number; open: number; overdue: number; dueWithin7Days: number; critical: number; escalated: number; nextDueAt: string | null };
export type DelaySummary = { total: number; critical: number; approvedCalculations: number; approvedExtensionDays: number };
export const RCC_PERMISSIONS = ['rcc.risk.view', 'rcc.risk.edit', 'rcc.change.raise', 'rcc.change.approve', 'rcc.claim.view', 'rcc.claim.edit', 'rcc.claim.submit', 'rcc.claim.decide', 'rcc.issue.view', 'rcc.issue.edit', 'rcc.issue.escalate', 'rcc.delay.view', 'rcc.delay.edit', 'rcc.delay.calculate', 'rcc.delay.approve'];
export const RCC_TABLES = { risks: 'Risk', changes: 'ChangeRequest', claims: 'Claim', issues: 'RccIssue', delays: 'DelayEvent' } as const;
export class RccValidationError extends Error {}
const bad = (message: string): never => { throw new RccValidationError(message); };
export function isoDay(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return bad('تاریخ میلادی معتبر لازم است');
  return value;
}
function text(input: Record<string, unknown>, key: string, max: number, required = false): string {
  const v = input[key] ?? '';
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) return bad(`فیلد ${key} نامعتبر یا خالی است`);
  return v.trim();
}
function number(input: Record<string, unknown>, key: string, min: number, max: number, integer = false): number {
  const v = input[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) return bad(`عدد ${key} نامعتبر است`);
  return v;
}
function optionalNumber(input: Record<string, unknown>, key: string, min: number, max: number, integer = false): number | null {
  const v = input[key];
  if (v === undefined || v === null || v === '') return null;
  return number({ Value: v }, 'Value', min, max, integer);
}
function optionalDay(input: Record<string, unknown>, key: string): string | null {
  const v = input[key];
  if (v === undefined || v === null || v === '') return null;
  return isoDay(v);
}
export function normalizeRcc(kind: RccKind, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { Code: text(b, 'Code', 40, true), TitleFa: text(b, 'TitleFa', 400, true) };
  if (!/^[\p{L}\p{N}_.\-/]+$/u.test(String(out.Code))) bad('کد باید بدون فاصله باشد');
  if (kind === 'risks') {
    out.Category = text(b, 'Category', 40, true);
    if (!RBS.some(r => r.code === out.Category)) bad('دستهٔ ریسک معتبر نیست');
    out.Probability = number(b, 'Probability', 1, 5, true);
    out.Impact = number(b, 'Impact', 1, 5, true);
    out.Score = Number(out.Probability) * Number(out.Impact);
    out.Owner = text(b, 'Owner', 120, true);
    for (const k of ['Cause', 'Event', 'Effect', 'Response']) out[k] = text(b, k, 1000);
    out.SourceRef = text(b, 'SourceRef', 200);
    for (const k of ['WbsCode', 'ActivityCode', 'BaselineId']) out[k] = text(b, k, 60);
    out.ReserveAmount = optionalNumber(b, 'ReserveAmount', 0, 1e15);
    out.ReserveUsedAmount = optionalNumber(b, 'ReserveUsedAmount', 0, 1e15);
    if (out.ReserveAmount !== null && out.ReserveUsedAmount !== null && Number(out.ReserveUsedAmount) > Number(out.ReserveAmount)) bad('مصرف ذخیره نمی‌تواند از مبلغ ذخیره بیشتر باشد');
    out.ReserveStatus = b.ReserveStatus ?? (out.ReserveAmount ? 'allocated' : 'none');
    if (!['none', 'allocated', 'partially_used', 'depleted', 'released'].includes(String(out.ReserveStatus))) bad('وضعیت ذخیرهٔ ریسک معتبر نیست');
    out.NextReviewDate = optionalDay(b, 'NextReviewDate');
    out.MonitoringNote = text(b, 'MonitoringNote', 1000);
    out.Status = b.Status ?? 'open';
    if (!['open', 'mitigated', 'accepted'].includes(String(out.Status))) bad('وضعیت ریسک نامعتبر است');
  } else if (kind === 'changes') {
    out.Reason = text(b, 'Reason', 1000, true);
    out.CostImpact = number(b, 'CostImpact', -1e15, 1e15);
    out.TimeImpactDays = number(b, 'TimeImpactDays', -36500, 36500, true);
    const assessment = b.Assessment;
    if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) bad('ارزیابی اثر لازم است');
    out.Assessment = Object.fromEntries(IMPACT_DIMS.map(k => [k, (assessment as Record<string, unknown>)[k] === true]));
    for (const k of ['WbsCode', 'ActivityCode', 'BaselineId']) out[k] = text(b, k, 60);
  } else if (kind === 'issues') {
    out.Description = text(b, 'Description', 1000);
    out.Severity = b.Severity ?? 'medium';
    if (!['low', 'medium', 'high', 'critical'].includes(String(out.Severity))) bad('شدت مسئله معتبر نیست');
    out.Owner = text(b, 'Owner', 120, true);
    out.DueDate = optionalDay(b, 'DueDate');
    out.RiskCode = text(b, 'RiskCode', 40);
    for (const k of ['WbsCode', 'ActivityCode']) out[k] = text(b, k, 60);
    out.SourceRef = text(b, 'SourceRef', 200);
  } else if (kind === 'delays') {
    out.Category = text(b, 'Category', 40, true);
    if (!['employer', 'contractor', 'concurrent', 'neutral', 'force_majeure', 'change_order', 'procurement', 'engineering_approval', 'payment', 'site_access', 'unknown'].includes(String(out.Category))) bad('طبقه‌بندی تأخیر معتبر نیست');
    out.SourceParty = text(b, 'SourceParty', 40);
    out.StartDate = isoDay(b.StartDate);
    out.FinishDate = isoDay(b.FinishDate);
    if (String(out.FinishDate) < String(out.StartDate)) bad('پایان تأخیر قبل از آغاز آن است');
    out.NoticedDate = optionalDay(b, 'NoticedDate');
    out.Status = b.Status ?? 'under_review';
    if (!['draft', 'under_review', 'accepted', 'rejected', 'closed'].includes(String(out.Status))) bad('وضعیت رویداد تأخیر معتبر نیست');
    for (const k of ['ContractCode', 'ClaimCode', 'RiskCode', 'IssueCode']) out[k] = text(b, k, 60);
    for (const k of ['WbsCode', 'ActivityCode', 'BaselineId', 'IpcId']) out[k] = text(b, k, 60);
    out.ClauseRef = text(b, 'ClauseRef', 200);
    out.EvidenceRef = text(b, 'EvidenceRef', 1000);
    const evidenceRefs = b.EvidenceRefs;
    if (evidenceRefs === undefined || evidenceRefs === null || evidenceRefs === '') out.EvidenceRefs = [];
    else if (!Array.isArray(evidenceRefs) || evidenceRefs.length > 50 || evidenceRefs.some(value => typeof value !== 'string' || !value.trim() || value.trim().length > 60)) bad('پیوند اسناد EDMS معتبر نیست');
    else out.EvidenceRefs = [...new Set(evidenceRefs.map(value => String(value).trim()))];
    out.RootCauseFa = text(b, 'RootCauseFa', 1000);
    out.EstimatedDelayDays = optionalNumber(b, 'EstimatedDelayDays', 0, 36500, true);
    out.CompletionImpactDays = optionalNumber(b, 'CompletionImpactDays', 0, 36500, true);
    out.IsCritical = b.IsCritical === true || b.IsCritical === 1 || b.IsCritical === '1';
  } else {
    out.EventDate = isoDay(b.EventDate);
    out.NoticeDays = number(b, 'NoticeDays', 1, 3650, true);
    out.Amount = number(b, 'Amount', 0, 1e15);
    out.ProposedAmount = optionalNumber(b, 'ProposedAmount', 0, 1e15);
    out.ExtensionDays = number(b, 'ExtensionDays', 0, 36500, true);
    for (const k of ['Entitlement', 'Causation', 'QuantumNote', 'EvidenceRef']) out[k] = text(b, k, 1000);
    out.Clause = text(b, 'Clause', 200, true);
    out.BaselineId = text(b, 'BaselineId', 60);
    out.DataDate = b.DataDate ? isoDay(b.DataDate) : null;
  }
  return out;
}
export function noticeState(row: Record<string, unknown>, today: string) {
  if (!row.EventDate || !row.NoticeDays) return { dueAt: null, daysLeft: null, timeBarred: null };
  const event = isoDay(row.EventDate);
  const due = new Date(event + 'T00:00:00Z');
  due.setUTCDate(due.getUTCDate() + Number(row.NoticeDays));
  const dueAt = due.toISOString().slice(0, 10);
  const delivered = row.NoticeDeliveredAt ? String(row.NoticeDeliveredAt).slice(0, 10) : null;
  return { dueAt, daysLeft: Math.round((Date.parse(dueAt) - Date.parse(isoDay(today))) / 86400000), timeBarred: (delivered ?? today) > dueAt };
}
export function summarizeNotices(rows: Record<string, unknown>[], today: string): NoticeSummary {
  const active = rows.filter((row) => !['withdrawn', 'closed'].includes(String(row.Status ?? '')));
  const out: NoticeSummary = { total: active.length, delivered: 0, timeBarred: 0, overdue: 0, dueWithin7Days: 0, dueWithin30Days: 0, unknownDeadline: 0, nextDueAt: null };
  const pendingDue: string[] = [];
  for (const row of active) {
    const state = noticeState(row, today);
    const delivered = Boolean(row.NoticeDeliveredAt);
    if (delivered) out.delivered++;
    if (state.timeBarred) out.timeBarred++;
    if (!state.dueAt) { out.unknownDeadline++; continue; }
    if (!delivered) {
      pendingDue.push(state.dueAt);
      if (state.daysLeft !== null && state.daysLeft < 0) out.overdue++;
      else if (state.daysLeft !== null && state.daysLeft <= 7) out.dueWithin7Days++;
      else if (state.daysLeft !== null && state.daysLeft <= 30) out.dueWithin30Days++;
    }
  }
  out.nextDueAt = pendingDue.sort()[0] ?? null;
  return out;
}

const dayText = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const textValue = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(textValue) ? textValue : null;
};
const daysUntil = (date: string | null, today: string): number | null => date ? Math.round((Date.parse(date) - Date.parse(isoDay(today))) / 86400000) : null;

export function riskReserveState(row: Record<string, unknown>, today: string) {
  const allocated = row.ReserveAmount === null || row.ReserveAmount === undefined || row.ReserveAmount === '' ? null : Number(row.ReserveAmount);
  const used = row.ReserveUsedAmount === null || row.ReserveUsedAmount === undefined || row.ReserveUsedAmount === '' ? null : Number(row.ReserveUsedAmount);
  const remaining = allocated === null ? null : allocated - (used ?? 0);
  const reviewDate = dayText(row.NextReviewDate);
  const reviewDaysLeft = daysUntil(reviewDate, today);
  return {
    allocated, used, remaining,
    usedPct: allocated && allocated > 0 ? ((used ?? 0) / allocated) * 100 : null,
    reviewDate, reviewDaysLeft,
    reviewOverdue: reviewDaysLeft !== null && reviewDaysLeft < 0,
    reviewDueSoon: reviewDaysLeft !== null && reviewDaysLeft >= 0 && reviewDaysLeft <= 7,
    depleted: allocated !== null && allocated > 0 && (used ?? 0) >= allocated,
  };
}

export function summarizeReserves(rows: Record<string, unknown>[], today: string): ReserveSummary {
  const out: ReserveSummary = { allocated: 0, used: 0, remaining: 0, monitored: 0, reviewOverdue: 0, reviewDueWithin7Days: 0, depleted: 0, nextReviewAt: null };
  const reviewDates: string[] = [];
  for (const row of rows) {
    const state = riskReserveState(row, today);
    out.allocated += state.allocated ?? 0;
    out.used += state.used ?? 0;
    if (row.LastReviewedAt) out.monitored++;
    if (state.reviewOverdue) out.reviewOverdue++;
    if (state.reviewDueSoon) out.reviewDueWithin7Days++;
    if (state.depleted) out.depleted++;
    if (state.reviewDate && !state.reviewOverdue) reviewDates.push(state.reviewDate);
    else if (state.reviewDate) reviewDates.push(state.reviewDate);
  }
  out.remaining = out.allocated - out.used;
  out.nextReviewAt = reviewDates.sort()[0] ?? null;
  return out;
}

export function riskReviewPatch(row: Record<string, unknown>, input: Record<string, unknown>, actor: string, nowIso: string): Record<string, unknown> {
  const note = text({ Note: input.note ?? '' }, 'Note', 1000, true);
  const nextReviewDate = input.nextReviewDate === undefined ? dayText(row.NextReviewDate) : optionalDay(input, 'nextReviewDate');
  const reserveAmount = input.reserveAmount === undefined ? (row.ReserveAmount ?? null) : optionalNumber({ ReserveAmount: input.reserveAmount }, 'ReserveAmount', 0, 1e15);
  const reserveUsedAmount = input.reserveUsedAmount === undefined ? (row.ReserveUsedAmount ?? null) : optionalNumber({ ReserveUsedAmount: input.reserveUsedAmount }, 'ReserveUsedAmount', 0, 1e15);
  if (reserveAmount !== null && reserveUsedAmount !== null && Number(reserveUsedAmount) > Number(reserveAmount)) bad('مصرف ذخیره نمی‌تواند از مبلغ ذخیره بیشتر باشد');
  let reserveStatus = input.reserveStatus === undefined ? String(row.ReserveStatus ?? (reserveAmount ? 'allocated' : 'none')) : String(input.reserveStatus);
  if (!['none', 'allocated', 'partially_used', 'depleted', 'released'].includes(reserveStatus)) bad('وضعیت ذخیرهٔ ریسک معتبر نیست');
  if (reserveAmount !== null && reserveUsedAmount !== null && Number(reserveAmount) > 0 && Number(reserveUsedAmount) >= Number(reserveAmount)) reserveStatus = 'depleted';
  return { ReserveAmount: reserveAmount, ReserveUsedAmount: reserveUsedAmount, ReserveStatus: reserveStatus, NextReviewDate: nextReviewDate, MonitoringNote: note, LastReviewedAt: nowIso, LastReviewedBy: actor };
}

export function issueEws(row: Record<string, unknown>, today: string) {
  const dueDate = dayText(row.DueDate);
  const daysLeft = daysUntil(dueDate, today);
  if (['resolved', 'closed'].includes(String(row.Status ?? ''))) return { code: null, severity: 'none', dueDate, daysLeft };
  if (daysLeft !== null && daysLeft < 0) return { code: 'EWS-ISS-03', severity: 'critical', dueDate, daysLeft };
  if (daysLeft !== null && daysLeft <= 3) return { code: 'EWS-ISS-02', severity: 'high', dueDate, daysLeft };
  if (row.Status === 'escalated' || ['high', 'critical'].includes(String(row.Severity ?? '')) || (daysLeft !== null && daysLeft <= 7)) return { code: 'EWS-ISS-01', severity: String(row.Severity ?? 'medium'), dueDate, daysLeft };
  return { code: null, severity: 'none', dueDate, daysLeft };
}

export function summarizeIssues(rows: Record<string, unknown>[], today: string): IssueSummary {
  const active = rows.filter(row => !['resolved', 'closed'].includes(String(row.Status ?? '')));
  const out: IssueSummary = { total: active.length, open: 0, overdue: 0, dueWithin7Days: 0, critical: 0, escalated: 0, nextDueAt: null };
  const dueDates: string[] = [];
  for (const row of active) {
    const ews = issueEws(row, today);
    if (row.Status === 'open') out.open++;
    if (ews.daysLeft !== null && ews.daysLeft < 0) out.overdue++;
    else if (ews.daysLeft !== null && ews.daysLeft <= 7) out.dueWithin7Days++;
    if (['high', 'critical'].includes(String(row.Severity ?? ''))) out.critical++;
    if (row.Status === 'escalated') out.escalated++;
    if (ews.dueDate) dueDates.push(ews.dueDate);
  }
  out.nextDueAt = dueDates.sort()[0] ?? null;
  return out;
}

export function normalizeClaimCostItem(b: Record<string, unknown>): Record<string, unknown> {
  const costType = text(b, 'CostType', 30, true);
  if (!(CLAIM_COST_TYPES as readonly string[]).includes(costType)) bad('نوع هزینهٔ ادعای مالی معتبر نیست');
  const amount = number(b, 'Amount', 0, 1e15);
  const periodFrom = optionalDay(b, 'PeriodFrom');
  const periodTo = optionalDay(b, 'PeriodTo');
  if (periodFrom && periodTo && periodTo < periodFrom) bad('پایان دورهٔ هزینه قبل از آغاز آن است');
  const documentRefs = b.DocumentRefs;
  let refs: string[] = [];
  if (documentRefs === undefined || documentRefs === null || documentRefs === '') refs = [];
  else if (!Array.isArray(documentRefs) || documentRefs.length > 50 || documentRefs.some(v => typeof v !== 'string' || !v.trim() || v.trim().length > 60)) bad('مستندات پشتیبان هزینه معتبر نیست');
  else refs = [...new Set(documentRefs.map(v => String(v).trim()))];
  const status = b.Status ?? 'draft';
  if (!['draft', 'submitted', 'approved', 'rejected'].includes(String(status))) bad('وضعیت آیتم هزینه معتبر نیست');
  // فیلدهای ماژول خسارت (PMO-CLAIMS-LOSS-ENGINE-V1.0): دسته از همان فهرست نوع هزینه
  // گرفته می‌شود تا دادهٔ قدیمی بدون مهاجرت معنایی کار کند.
  const costNature = b.CostNature === undefined || b.CostNature === null || b.CostNature === '' ? null : String(b.CostNature);
  if (costNature !== null && !['direct', 'indirect'].includes(costNature)) bad('ماهیت هزینه (مستقیم/غیرمستقیم) معتبر نیست');
  const resourceKind = b.ResourceKind === undefined || b.ResourceKind === null || b.ResourceKind === '' ? null : String(b.ResourceKind);
  if (resourceKind !== null && !['none', 'labor', 'machinery', 'other'].includes(resourceKind)) bad('نوع منبع هزینه معتبر نیست');
  return {
    CostType: costType, TitleFa: text(b, 'TitleFa', 400, true), Amount: amount, Currency: text(b, 'Currency', 10), Basis: text(b, 'Basis', 1000), PeriodFrom: periodFrom, PeriodTo: periodTo, DocumentRefs: refs, Status: status, ClaimCode: text(b, 'ClaimCode', 40),
    LossCategory: text(b, 'LossCategory', 40) || costType, CostNature: costNature,
    Quantity: optionalNumber(b, 'Quantity', 0, 1e12), Rate: optionalNumber(b, 'Rate', 0, 1e15), UnitFa: text(b, 'UnitFa', 60),
    DocumentedAmount: optionalNumber(b, 'DocumentedAmount', 0, 1e15), ApprovedAmount: optionalNumber(b, 'ApprovedAmount', 0, 1e15),
    RuleCode: text(b, 'RuleCode', 60), ResourceKind: resourceKind, ResourceNameFa: text(b, 'ResourceNameFa', 300),
    WorkedUnits: optionalNumber(b, 'WorkedUnits', 0, 1e9), IdleUnits: optionalNumber(b, 'IdleUnits', 0, 1e9),
  };
}

export function summarizeMonetaryClaim(items: Record<string, unknown>[]): MonetarySummary {
  const byType: Record<string, number> = {};
  let totalAmount = 0;
  for (const item of items) {
    const amount = Number(item.Amount) || 0;
    totalAmount += amount;
    const type = String(item.CostType ?? 'other');
    byType[type] = (byType[type] ?? 0) + amount;
  }
  return { items: items.length, totalAmount: Math.round(totalAmount * 100) / 100, byType };
}

/** مهلت‌های حیاتی قراردادی: مهلت ابلاغ ادعاهای تحویل‌نشده (از جمله مهلت ۲۸روزه) با روزشمار باقی‌مانده. */
export function contractualDeadlineAlerts(claims: Record<string, unknown>[], today: string, horizonDays = 30): DeadlineAlert[] {
  const out: DeadlineAlert[] = [];
  for (const claim of claims) {
    if (['withdrawn', 'closed'].includes(String(claim.Status ?? '')) || claim.NoticeDeliveredAt) continue;
    const state = noticeState(claim, today);
    if (!state.dueAt || state.daysLeft === null) continue;
    if (state.daysLeft > horizonDays) continue;
    out.push({
      claimId: String(claim.Id ?? ''), claimCode: String(claim.Code ?? ''), titleFa: String(claim.TitleFa ?? ''),
      dueAt: state.dueAt, daysLeft: state.daysLeft,
      severity: state.daysLeft < 0 ? 'overdue' : state.daysLeft <= 7 ? 'critical' : 'warning',
      owner: (claim.SubmittedBy ?? claim.CreatedBy ?? null) as string | null,
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.claimCode.localeCompare(b.claimCode));
}

export function summarizeDelays(rows: Record<string, unknown>[], calculations: Record<string, unknown>[]): DelaySummary {
  const eventIds = new Set(rows.map(row => String(row.Id ?? '')));
  const selected = selectApprovedExtensionCalculations(calculations.filter(row => eventIds.has(String(row.DelayEventId ?? ''))));
  return {
    total: rows.length,
    critical: rows.filter((row) => row.IsCritical === true || row.IsCritical === 1 || row.IsCritical === '1').length,
    approvedCalculations: selected.calculations.length,
    approvedExtensionDays: selected.totalDays,
  };
}

export type IssueAction = 'start' | 'escalate' | 'resolve' | 'reopen' | 'close';
export const ISSUE_TRANSITIONS: Record<IssueAction, { from: string[]; to: string; actor: 'edit' | 'escalate'; noteRequired: boolean }> = {
  start: { from: ['open', 'escalated'], to: 'in_progress', actor: 'edit', noteRequired: false },
  escalate: { from: ['open', 'in_progress'], to: 'escalated', actor: 'escalate', noteRequired: true },
  resolve: { from: ['in_progress', 'escalated'], to: 'resolved', actor: 'edit', noteRequired: true },
  reopen: { from: ['resolved'], to: 'in_progress', actor: 'edit', noteRequired: true },
  close: { from: ['resolved'], to: 'closed', actor: 'escalate', noteRequired: true },
};

export function issueTransitionPatch(row: Record<string, unknown>, input: Record<string, unknown>, actor: string, nowIso: string): Record<string, unknown> {
  const action = typeof input.action === 'string' ? input.action : '';
  const rule = ISSUE_TRANSITIONS[action as IssueAction];
  if (!rule) bad('اقدام مسئله معتبر نیست');
  if (!rule.from.includes(String(row.Status ?? ''))) bad('این اقدام در وضعیت فعلی مسئله مجاز نیست');
  const note = text({ Note: input.note ?? '' }, 'Note', 1000, rule.noteRequired);
  const patch: Record<string, unknown> = { Status: rule.to };
  if (action === 'escalate') Object.assign(patch, { EscalationLevel: Math.min(3, (Number(row.EscalationLevel) || 0) + 1), EscalationNote: note, EscalatedBy: actor, EscalatedAt: nowIso });
  if (action === 'resolve') Object.assign(patch, { ResolutionNote: note, ResolvedBy: actor, ResolvedAt: nowIso });
  if (action === 'reopen') Object.assign(patch, { ResolutionNote: note, ResolvedBy: null, ResolvedAt: null });
  if (action === 'close') Object.assign(patch, { ClosedBy: actor, ClosedAt: nowIso });
  return patch;
}

export type ClaimLifecycleAction = 'start_review' | 'negotiate' | 'determine' | 'reject' | 'settle' | 'dispute' | 'withdraw' | 'close';
export const CLAIM_LIFECYCLE_TRANSITIONS: Record<ClaimLifecycleAction, { from: string[]; to: string; actor: 'decide' | 'edit'; noteRequired: boolean; values?: 'determined' | 'settlement' }> = {
  start_review: { from: ['submitted'], to: 'under_review', actor: 'decide', noteRequired: false },
  negotiate: { from: ['under_review', 'determined', 'disputed'], to: 'negotiation', actor: 'decide', noteRequired: true },
  determine: { from: ['under_review', 'negotiation'], to: 'determined', actor: 'decide', noteRequired: true, values: 'determined' },
  reject: { from: ['submitted', 'under_review', 'negotiation'], to: 'rejected', actor: 'decide', noteRequired: true },
  settle: { from: ['negotiation', 'determined', 'disputed'], to: 'settled', actor: 'decide', noteRequired: true, values: 'settlement' },
  dispute: { from: ['determined', 'rejected'], to: 'disputed', actor: 'edit', noteRequired: true },
  withdraw: { from: ['draft', 'submitted', 'under_review', 'negotiation', 'determined', 'disputed'], to: 'withdrawn', actor: 'edit', noteRequired: true },
  close: { from: ['settled', 'rejected', 'withdrawn'], to: 'closed', actor: 'decide', noteRequired: true },
};

export function claimLifecyclePatch(row: Record<string, unknown>, input: Record<string, unknown>, actor: string, nowIso: string): Record<string, unknown> {
  const action = typeof input.action === 'string' ? input.action : '';
  const rule = CLAIM_LIFECYCLE_TRANSITIONS[action as ClaimLifecycleAction];
  if (!rule) bad('اقدام چرخهٔ ادعا معتبر نیست');
  if (!rule.from.includes(String(row.Status ?? ''))) bad('این اقدام در وضعیت فعلی ادعا مجاز نیست');
  const note = text({ Note: input.note ?? '' }, 'Note', 1000, rule.noteRequired);
  const hasAmount = input.amount !== undefined && input.amount !== null && input.amount !== '';
  const hasDays = input.days !== undefined && input.days !== null && input.days !== '';
  if (!rule.values && (hasAmount || hasDays)) bad('برای این اقدام مبلغ یا مدت تعیین نمی‌شود');

  let amount: number | undefined;
  let days: number | undefined;
  if (rule.values === 'determined') {
    if (!hasAmount || !hasDays) bad('مبلغ و مدت تعیین‌شده لازم است');
    amount = number({ Value: input.amount }, 'Value', 0, Number(row.Amount ?? 1e15));
    days = number({ Value: input.days }, 'Value', 0, Number(row.ExtensionDays ?? 36500), true);
  } else if (rule.values === 'settlement') {
    if (!hasAmount || !hasDays) bad('مبلغ و مدت تسویه لازم است');
    amount = number({ Value: input.amount }, 'Value', 0, Number(row.DeterminedAmount ?? row.Amount ?? 1e15));
    days = number({ Value: input.days }, 'Value', 0, Number(row.DeterminedDays ?? row.ExtensionDays ?? 36500), true);
  }

  const patch: Record<string, unknown> = { Status: rule.to };
  switch (action as ClaimLifecycleAction) {
    case 'start_review': Object.assign(patch, { ReviewNote: note, ReviewBy: actor, ReviewAt: nowIso }); break;
    case 'negotiate': Object.assign(patch, { NegotiationNote: note, NegotiationBy: actor, NegotiationAt: nowIso }); break;
    case 'determine': Object.assign(patch, { DeterminedAmount: amount, DeterminedDays: days, DeterminationNote: note, DeterminedBy: actor, DeterminedAt: nowIso }); break;
    case 'reject': Object.assign(patch, { RejectionNote: note, RejectedBy: actor, RejectedAt: nowIso }); break;
    case 'settle': Object.assign(patch, { SettlementAmount: amount, SettlementDays: days, SettlementNote: note, SettledBy: actor, SettledAt: nowIso }); break;
    case 'dispute': Object.assign(patch, { DisputeNote: note, DisputedBy: actor, DisputedAt: nowIso }); break;
    case 'withdraw': Object.assign(patch, { WithdrawalNote: note, WithdrawnBy: actor, WithdrawnAt: nowIso }); break;
    case 'close': Object.assign(patch, { ClosureNote: note, ClosedBy: actor, ClosedAt: nowIso }); break;
  }
  return patch;
}

export function changeReady(row: Record<string, unknown>): boolean {
  let a = row.Assessment;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return false; } }
  return Boolean(a) && IMPACT_DIMS.every(k => (a as Record<string, unknown>)[k] === true);
}
export function claimIssues(row: Record<string, unknown>, today: string): string[] {
  const issues: string[] = [];
  for (const k of ['Entitlement', 'Causation', 'QuantumNote', 'EvidenceRef', 'BaselineId', 'DataDate', 'NoticeRef', 'NoticeDeliveredAt']) if (!row[k]) issues.push(k);
  const state = noticeState(row, today);
  if (state.timeBarred !== false) issues.push('NoticeDeadline');
  if (row.DataDate && String(row.DataDate) > today) issues.push('FutureDataDate');
  return issues;
}
