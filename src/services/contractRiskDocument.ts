/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — مولد گزارش جامع ریسک قراردادی (Word/PDF).
 * از دادهٔ واقعی Workspace ساخته می‌شود؛ دادهٔ ناقص «—» و عددی حدس زده
 * نمی‌شود. خروجی مستقیم رسمی است: بدون راهنمای داخلی و با فونت B Nazanin.
 * امتیاز ریسک در این گزارش فقط اولویت است و هیچ مبلغ/مدت تمدیدی از آن
 * ساخته نمی‌شود.
 */
import { summarizeContractRiskPortfolio, type ContractRiskLike } from "./contractRisk";

type Row = Record<string, any>;
const esc = (v: unknown): string => String(v ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (v: unknown): string => {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? "—" : n.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
};
const faDate = (v: unknown): string => {
  const s = String(v ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
  try { return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(s + "T00:00:00")); } catch { return s; }
};
const BAND_FA: Record<string, string> = { low: "پایین", medium: "متوسط", high: "بالا", critical: "بحرانی" };
const STRAT_FA: Record<string, string> = { avoid: "اجتناب", mitigate: "کاهش", transfer: "انتقال", accept: "پذیرش آگاهانه", exploit: "بهره‌برداری" };
const table = (heads: string[], rows: string[][]): string =>
  `<table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}">داده‌ای ثبت نشده است</td></tr>`}</tbody></table>`;

export type ContractRiskReportInput = {
  projectId: string;
  scope: "all" | "critical";
  contractCode?: string | null;
  category?: string | null;
  risks: Row[]; actions: Row[]; obligations: Row[]; improvements: Row[]; findings: Row[];
  assessments: Row[]; contracts: Row[]; amendments: Row[];
  links: { delayEvents: Row[]; claims: Row[] };
  generatedAt: string; generatedBy?: string; scoringVersionNote: string;
};

export function buildContractRiskReport(input: ContractRiskReportInput) {
  const today = input.generatedAt.slice(0, 10);
  const pendingFindings = input.findings.filter((f) => f.ReviewStatus === "pending").length;
  const summary = summarizeContractRiskPortfolio(input.risks as ContractRiskLike[], input.actions, input.obligations, input.improvements, pendingFindings, today);
  let risks = input.risks;
  if (input.contractCode) risks = risks.filter((r) => r.ContractCode === input.contractCode);
  if (input.category) risks = risks.filter((r) => r.Category === input.category);
  const riskRows = input.scope === "critical" ? risks.filter((r) => r.InherentBand === "critical" || r.InherentBand === "high") : risks;
  const overdueObligations = input.obligations.filter((o) => o.Status === "pending" && o.DueDate && o.DueDate < today);
  const overdueActions = input.actions.filter((a) => a.Status !== "done" && a.Status !== "cancelled" && a.DueDate && a.DueDate < today);
  const residualHigh = risks.filter((r) => r.ResidualBand === "critical" || r.ResidualBand === "high");
  const clausesToFix = input.improvements.filter((i) => i.Status !== "rejected" && i.Status !== "obsolete");

  const matrixHeads = ["احتمال \\ اثر", "۱", "۲", "۳", "۴", "۵"];
  const matrixRows = [5, 4, 3, 2, 1].map((p) => [String(p), ...[1, 2, 3, 4, 5].map((i) => String(summary.matrix[`${p}x${i}`] ?? 0))]);
  const trendRows = [...input.assessments].sort((a, b) => String(a.AssessedAt).localeCompare(String(b.AssessedAt))).slice(-30)
    .map((a) => [esc(a.RiskCode), faDate(a.AssessedAt), num(a.InherentScore), esc(BAND_FA[a.InherentBand] ?? "—"), num(a.ResidualScore), esc(BAND_FA[a.ResidualBand] ?? "—"), esc(a.ScoringVersion)]);

  const chapters: { title: string; body: string }[] = [
    { title: "۱- مشخصات گزارش", body: table(["مشخصه", "مقدار"], [
      ["پروژه", esc(input.projectId)], ["دامنهٔ گزارش", input.scope === "critical" ? "فقط ریسک‌های بحرانی و بالا" : "جامع"],
      ["قرارداد", esc(input.contractCode)], ["دسته", esc(input.category)], ["تاریخ تهیه", faDate(today)],
      ["تهیه‌کننده", esc(input.generatedBy)], ["روش امتیازدهی", esc(input.scoringVersionNote)],
    ]) },
    { title: "۲- خلاصهٔ مدیریتی", body: table(["شاخص", "مقدار"], [
      ["کل ریسک‌های ثبت‌شده", num(summary.totalRisks)], ["بحرانی (ذاتی)", num(summary.critical)], ["بالا", num(summary.high)],
      ["متوسط", num(summary.medium)], ["پایین", num(summary.low)], ["ارزیابی‌نشده", num(summary.unassessed)],
      ["فاقد مالک", num(summary.ownerless)], ["کنترل ناکافی", num(summary.inadequateControl)],
      ["باقیماندهٔ بحرانی", num(summary.residualCritical)], ["اقدامات معوق", num(summary.overdueActions)],
      ["تعهدات سررسیدگذشته", num(summary.overdueObligations)], ["پیشنهاد اصلاح در انتظار تأیید", num(summary.improvementsPendingApproval)],
      ["ریسک مرتبط با ادعای فعال", num(summary.linkedActiveClaims)],
    ]) + `<p>امتیاز ریسک صرفاً ابزار اولویت‌بندی است و به‌تنهایی وقوع خسارت، استحقاق مالی یا مدت تمدید را اثبات نمی‌کند.</p>` },
    { title: "۳- ماتریس احتمال و اثر (ذاتی)", body: table(matrixHeads, matrixRows) },
    { title: input.scope === "critical" ? "۴- ریسک‌های بحرانی و بالا" : "۴- دفتر ثبت ریسک‌های قراردادی", body: table(
      ["کد", "عنوان", "قرارداد", "بند منشأ", "مالک", "احتمال", "امتیاز ذاتی", "رتبه", "امتیاز باقیمانده", "رتبهٔ نهایی", "وضعیت"],
      riskRows.map((r) => [esc(r.Code), esc(r.TitleFa), esc(r.ContractCode), esc(r.ClauseRef), esc(r.Owner), num(r.Probability), num(r.InherentScore), esc(BAND_FA[r.InherentBand] ?? "—"), num(r.ResidualScore), esc(BAND_FA[r.ResidualBand] ?? "—"), esc(r.Status)])) },
    { title: "۵- ریسک‌های باقیماندهٔ بالا پس از کنترل", body: table(["کد", "عنوان", "ذاتی", "باقیمانده", "اثربخشی کنترل"], residualHigh.map((r) => [esc(r.Code), esc(r.TitleFa), num(r.InherentScore), num(r.ResidualScore), esc(r.ControlEffectiveness)])) },
    { title: "۶- تعهدات سررسیدگذشته", body: table(["کد", "تعهد", "قرارداد", "بند", "طرف مسئول", "موعد", "ریسک مرتبط"], overdueObligations.map((o) => [esc(o.Code), esc(o.TitleFa), esc(o.ContractCode), esc(o.ClauseRef), esc(o.ResponsibleParty), faDate(o.DueDate), esc(o.RiskCode)])) },
    { title: "۷- اقدامات پاسخ معوق و وضعیت برنامهٔ پاسخ", body: table(["کد", "ریسک", "راهبرد", "اقدام", "مجری", "موعد", "پیشرفت", "وضعیت"], input.actions.map((a) => [esc(a.Code), esc(a.RiskCode), esc(STRAT_FA[a.Strategy] ?? a.Strategy), esc(a.TitleFa), esc(a.Owner), faDate(a.DueDate), num(a.ProgressPct) + "٪", esc(a.Status) + (overdueActions.some((x) => x.Id === a.Id) ? " (معوق)" : "")])) },
    { title: "۸- بندهای نیازمند اصلاح و وضعیت پیشنهادها", body: table(["کد", "بند", "مشکل", "وضعیت", "بازبین"], clausesToFix.map((i) => [esc(i.Code), esc(i.ClauseRef), esc(i.ProblemFa), esc(i.Status), esc(i.ReviewerBy)])) },
    { title: "۹- قراردادها و الحاقیه‌ها (مقایسهٔ نسخه‌ها در سطح سوابق)", body: table(["کد", "عنوان", "مبلغ", "واحد پول"], input.contracts.map((c) => [esc(c.Code), esc(c.TitleFa ?? c.NameFa), num(c.Amount), esc(c.Currency)])) + table(["کد الحاقیه", "عنوان", "تاریخ اثر", "تغییر مبلغ", "تغییر مدت (روز)"], input.amendments.map((a) => [esc(a.Code), esc(a.TitleFa), faDate(a.EffectiveDate), num(a.AmountDelta), num(a.DurationDeltaDays)])) },
    { title: "۱۰- ارتباط ریسک با تأخیرات", body: table(["ریسک", "رویداد تأخیر", "عنوان رویداد", "وضعیت رویداد"], risks.filter((r) => r.DelayEventCode).map((r) => { const d = input.links.delayEvents.find((x) => x.code === r.DelayEventCode); return [esc(r.Code), esc(r.DelayEventCode), esc(d?.titleFa), esc(d?.status ?? "یافت نشد در ماژول تأخیرات")]; })) + `<p>ریسک تأخیر به معنای وقوع قطعی تأخیر نیست و مدت احتمالی آن خودکار به تمدید قابل استحقاق تبدیل نمی‌شود.</p>` },
    { title: "۱۱- ارتباط ریسک با پرونده‌های خسارت", body: table(["ریسک", "پروندهٔ خسارت", "وضعیت پرونده", "مبلغ ثبت‌شده", "مبلغ تأییدشده"], risks.filter((r) => r.ClaimCode).map((r) => { const c = input.links.claims.find((x) => x.code === r.ClaimCode); return [esc(r.Code), esc(r.ClaimCode), esc(c?.status ?? "یافت نشد در ماژول خسارت"), num(c?.amount), num(c?.approvedAmount)]; })) + `<p>مبالغ فوق فقط نمایش دادهٔ موجود ماژول خسارت است؛ هیچ مبلغی بر اساس امتیاز ریسک محاسبه یا منتقل نشده است.</p>` },
    { title: "۱۲- روند تغییرات امتیاز ریسک", body: table(["ریسک", "تاریخ ارزیابی", "ذاتی", "رتبه", "باقیمانده", "رتبهٔ نهایی", "نسخهٔ روش"], trendRows) },
    { title: "۱۳- یافته‌های تحلیل بندها و پیوست منابع", body: table(["بند", "نوع یافته", "یافته", "اطمینان", "منبع", "وضعیت بررسی"], input.findings.map((f) => [esc(f.ClauseNo), esc(f.Kind), esc(f.FindingFa), num(f.Confidence), esc(f.SourceRef), esc(f.ReviewStatus)])) },
  ];

  const body = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>گزارش ریسک قراردادی</title>
<style>@page { margin: 2cm; } body { font-family: 'B Nazanin', Tahoma, sans-serif; font-size: 12pt; line-height: 1.9; color: #111; } h1 { font-size: 17pt; text-align: center; } h2 { font-size: 14pt; border-bottom: 2px solid #0f4c5c; padding-bottom: 4px; margin-top: 28px; } table { width: 100%; border-collapse: collapse; margin: 10px 0; } th { background: #0f4c5c; color: #fff; padding: 6px; font-size: 10.5pt; } td { border: 1px solid #bbb; padding: 5px; font-size: 10.5pt; } .meta { text-align: center; color: #444; }</style></head>
<body><h1>گزارش ${input.scope === "critical" ? "ریسک‌های بحرانی" : "جامع"} ریسک‌های قراردادی و بهبود قرارداد</h1>
<p class="meta">پروژه: ${esc(input.projectId)} · تاریخ تهیه: ${faDate(today)} · PMO-CONTRACT-RISK-ENGINE-V1.0</p>
${chapters.map((c) => `<h2>${esc(c.title)}</h2>${c.body}`).join("\n")}
</body></html>`;

  return {
    body,
    filename: `contract-risk-report-${input.scope}.doc`,
    contentType: "application/msword; charset=utf-8",
    issues: [] as string[],
    chapterCount: chapters.length,
  };
}
