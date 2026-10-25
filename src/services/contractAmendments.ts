/** چرخهٔ الحاقیه؛ وضعیت و آثار مالی فقط از تصمیم سرور به‌دست می‌آیند. */
export class AmendmentError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type AmendmentFields = {
  Code: string; TitleFa: string; AmendmentType: string; EffectiveDate: string;
  AmountDelta: number; DurationDeltaDays: number; LinkedCrCode: string | null; DocumentRef: string;
};
const fail = (message: string): never => { throw new AmendmentError(422, "E-CNT-AMENDMENT-VALIDATION", message); };
export function normalizeAmendment(input: Record<string, unknown>): AmendmentFields {
  const text = (field: string, max: number, required = true) => {
    if (input[field] != null && typeof input[field] !== "string") fail(`نوع فیلد ${field} نامعتبر است`);
    const value = String(input[field] ?? "").trim();
    if ((required && !value) || value.length > max) fail(`فیلد ${field} الزامی یا طول آن نامعتبر است`);
    return value;
  };
  const number = (field: string, integer = false) => {
    const raw = input[field];
    if (raw != null && typeof raw !== "number" && typeof raw !== "string") fail(`عدد ${field} نامعتبر است`);
    const n = raw == null || raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || Math.abs(n) > (integer ? 100000 : 1e14) || (integer && !Number.isInteger(n))) fail(`عدد ${field} نامعتبر است`);
    return integer ? n : Math.round(n * 100) / 100;
  };
  const date = text("EffectiveDate", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail("تاریخ اثر معتبر نیست");
  const type = text("AmendmentType", 20);
  if (!["amount", "duration", "scope", "rate"].includes(type)) fail("نوع الحاقیه معتبر نیست");
  const amount = number("AmountDelta"), duration = number("DurationDeltaDays", true);
  if (type === "amount" && !amount) fail("تغییر مبلغ نمی‌تواند صفر باشد");
  if (type === "duration" && !duration) fail("تغییر مدت نمی‌تواند صفر باشد");
  return { Code: text("Code", 40), TitleFa: text("TitleFa", 400), AmendmentType: type, EffectiveDate: date,
    AmountDelta: amount, DurationDeltaDays: duration, LinkedCrCode: text("LinkedCrCode", 40, false) || null, DocumentRef: text("DocumentRef", 200) };
}
export type AmendmentRecord = {
  Status: string; CreatedBy?: string | null; UpdatedBy?: string | null; SubmittedBy?: string | null;
  AmountDelta?: number | null; DurationDeltaDays?: number | null;
};
export function amendmentTransition(row: AmendmentRecord, action: string, actor: string, note: string) {
  const next = row.Status === "draft" ? ({ submit: "submitted", cancel: "cancelled" } as Record<string, string>)[action]
    : row.Status === "submitted" ? ({ approve: "approved", reject: "rejected" } as Record<string, string>)[action] : undefined;
  if (!next) throw new AmendmentError(409, "E-CNT-AMENDMENT-STATE", "این اقدام در وضعیت فعلی مجاز نیست؛ صفحه را بازخوانی کنید");
  if (["approve", "reject"].includes(action) && (!row.CreatedBy || !row.SubmittedBy || [row.CreatedBy, row.SubmittedBy].includes(actor))) {
    throw new AmendmentError(403, "E-CNT-AMENDMENT-SOD", "تصمیم‌گیرنده باید از ثبت‌کننده و ارسال‌کنندهٔ الحاقیه مستقل باشد");
  }
  if (["approve", "reject", "cancel"].includes(action) && !note.trim()) fail("شرح تصمیم یا دلیل اقدام الزامی است");
  if (note.length > 2000) fail("شرح تصمیم بیش از حد مجاز است");
  return next;
}
/** مدت اولیه تغییر نمی‌کند؛ مدت جاری از الحاقیه‌های مصوب مشتق می‌شود. */
export function amendmentTotals(initialAmount: number, initialDays: number, rows: AmendmentRecord[]) {
  const approved = rows.filter(r => r.Status === "approved");
  const currentAmount = Math.round((initialAmount + approved.reduce((s, r) => s + Number(r.AmountDelta ?? 0), 0)) * 100) / 100;
  const currentDurationDays = initialDays + approved.reduce((s, r) => s + Number(r.DurationDeltaDays ?? 0), 0);
  if (!Number.isFinite(currentAmount) || currentAmount < 0 || currentAmount > 1e15 || !Number.isSafeInteger(currentDurationDays) || currentDurationDays < 1 || currentDurationDays > 2147483647) fail("اثر الحاقیه موجب مبلغ منفی یا مدت نامعتبر پیمان می‌شود");
  return { currentAmount, currentDurationDays };
}
