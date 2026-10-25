/** تغییر مقدار و کار جدید: مبلغ پیمان را تغییر نمی‌دهند؛ فقط فهرست بهای مصوب را. */
import { amendmentTransition, AmendmentError } from './contractAmendments';
export class VariationError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const invalid = (message: string): never => { throw new VariationError(422, 'E-CNT-VARIATION-VALIDATION', message); };
export function variationText(input: Record<string, unknown>, key: string, max: number, required = true) {
  const raw = input[key];
  if (raw != null && typeof raw !== 'string') invalid(`نوع فیلد ${key} نامعتبر است`);
  const value = String(raw ?? '').trim();
  if ((required && !value) || value.length > max) invalid(`فیلد ${key} الزامی یا طول آن نامعتبر است`);
  return value;
}
export function variationNumber(value: unknown, label: string, digits: number, min = 0, max = 1e12): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') invalid(`${label} الزامی است`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || Math.abs(n * 10 ** digits - Math.round(n * 10 ** digits)) > 0.01) invalid(`${label} نامعتبر است یا اعشار بیش از حد مجاز دارد`);
  return Math.round(n * 10 ** digits) / 10 ** digits;
}
const common = (b: Record<string, unknown>) => ({
  ReasonFa: variationText(b, 'ReasonFa', 1000), DocumentRef: variationText(b, 'DocumentRef', 200), LinkedCrCode: variationText(b, 'LinkedCrCode', 40, false) || null,
});
export function normalizeQuantityChange(b: Record<string, unknown>) {
  return { ...common(b), BoqItemId: variationText(b, 'BoqItemId', 60), ChangeNo: variationNumber(b.ChangeNo, 'شماره تغییر', 0, 1, 2147483647), NewQty: variationNumber(b.NewQty, 'مقدار جدید', 3) };
}
export function normalizeExtraWork(b: Record<string, unknown>) {
  const method = variationText(b, 'AnalysisMethod', 30);
  if (!['similar_item', 'rate_analysis', 'daywork'].includes(method)) invalid('روش تحلیل نرخ نامعتبر است');
  return { ...common(b), Code: variationText(b, 'Code', 40), TitleFa: variationText(b, 'TitleFa', 600), Unit: variationText(b, 'Unit', 20),
    Quantity: variationNumber(b.Quantity, 'مقدار کار جدید', 3, 0.001), ProposedRate: variationNumber(b.ProposedRate, 'نرخ پیشنهادی', 2, 0.01), AnalysisMethod: method };
}
export type VariationBase = { RowVersion: number; ContractQty: number; UnitRate: number; PricingBasis: string; Status: string; RateStatus: string };
export function quantityEffect(base: VariationBase, newQty: number) {
  if (base.PricingBasis !== 'unit_price' || base.Status !== 'active' || base.RateStatus !== 'agreed') invalid('تغییر مقدار فقط برای ردیف فعال فهرست‌بهایی با نرخ توافق‌شده مجاز است');
  const previous = variationNumber(base.ContractQty, 'مقدار مبنا', 3);
  const rate = variationNumber(base.UnitRate, 'نرخ مبنا', 2);
  if (newQty === previous) invalid('مقدار جدید با مقدار فعلی یکسان است');
  const lineAmount = Math.round(newQty * rate * 100) / 100;
  if (!Number.isFinite(lineAmount) || lineAmount > 1e15) invalid('مبلغ ردیف بیش از حد مجاز است');
  return { PreviousQty: previous, UnitRateSnapshot: rate, BaseRowVersion: base.RowVersion,
    DeltaAmount: Math.round((newQty - previous) * rate * 100) / 100, LineAmount: lineAmount };
}
export function assertQuantityBase(row: { BaseRowVersion?: number; PreviousQty?: number; UnitRateSnapshot?: number }, base: VariationBase) {
  if (row.BaseRowVersion !== base.RowVersion || row.PreviousQty !== Number(base.ContractQty) || row.UnitRateSnapshot !== Number(base.UnitRate)) {
    throw new VariationError(409, 'E-CNT-VARIATION-BASE', 'ردیف مبنا تغییر کرده است؛ درخواست را در پیش‌نویس بازبینی کنید یا درخواست تازه ثبت کنید');
  }
}
export function variationTransition(kind: 'quantity' | 'extra', row: { Status: string; CreatedBy?: string; SubmittedBy?: string }, action: string, actor: string, note: string) {
  const status = kind === 'extra' ? ({ proposed: 'draft', rate_pending: 'submitted', agreed: 'approved' } as Record<string, string>)[row.Status] ?? row.Status : row.Status;
  try {
    const next = amendmentTransition({ ...row, Status: status }, action, actor, note);
    return kind === 'extra' ? ({ draft: 'proposed', submitted: 'rate_pending', approved: 'agreed' } as Record<string, string>)[next] ?? next : next;
  } catch (err) {
    if (err instanceof AmendmentError) throw new VariationError(err.status, err.code.replace('AMENDMENT', 'VARIATION'), err.message.replace(/الحاقیه/g, 'درخواست'));
    throw err;
  }
}
