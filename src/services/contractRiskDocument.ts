/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — مولد گزارش ریسک قراردادی (Word/PDF).
 * استاندارد صنعتی سند: دقیقاً ۱۸ فصل و ۵۱ جدول (RISK_DOC_TABLES).
 * Auto-Cleanup هنگام صدور: صفحات/بخش‌های راهنمای داخلی حذف، برچسب‌های
 * «الزامی/اختیاری» پاک، هایلایت‌های زرد شفاف و فونت رسمی B Nazanin اعمال
 * می‌شود. از دادهٔ واقعی Workspace ساخته می‌شود؛ دادهٔ ناقص «—» و عددی
 * حدس زده نمی‌شود. امتیاز ریسک فقط اولویت است و مبلغ/مدت تمدید نمی‌سازد.
 */
import { summarizeContractRiskPortfolio, DEFAULT_SCORING_CONFIG, type ContractRiskLike } from "./contractRisk";

export const RISK_DOC_CHAPTERS: { no: number; fa: string; en: string }[] = [
  { no: 1, fa: "صفحه عنوان و مشخصات سند", en: "Cover & document control" },
  { no: 2, fa: "مشخصات پروژه و قراردادها", en: "Project & contracts" },
  { no: 3, fa: "خلاصه مدیریتی", en: "Executive summary" },
  { no: 4, fa: "روش امتیازدهی و قواعد ارزیابی", en: "Scoring method & rules" },
  { no: 5, fa: "دفتر ثبت ریسک‌های قراردادی", en: "Risk register" },
  { no: 6, fa: "ریسک‌های بحرانی و بالا", en: "Critical & high risks" },
  { no: 7, fa: "ماتریس احتمال و اثر", en: "Probability-impact matrix" },
  { no: 8, fa: "ابعاد اثر و تحلیل دسته‌بندی", en: "Impact dimensions & categories" },
  { no: 9, fa: "کنترل‌های موجود و اثربخشی آن‌ها", en: "Existing controls & effectiveness" },
  { no: 10, fa: "ریسک‌های باقیمانده", en: "Residual risks" },
  { no: 11, fa: "تعهدات و مهلت‌های قراردادی", en: "Obligations & deadlines" },
  { no: 12, fa: "تعهدات سررسیدگذشته", en: "Overdue obligations" },
  { no: 13, fa: "برنامه پاسخ به ریسک", en: "Risk response plan" },
  { no: 14, fa: "اقدامات معوق و اثربخشی اقدامات", en: "Overdue & ineffective actions" },
  { no: 15, fa: "تحلیل بندهای قرارداد", en: "Clause analysis" },
  { no: 16, fa: "پیشنهادهای اصلاح و بهبود قرارداد", en: "Improvement proposals" },
  { no: 17, fa: "ارتباط با تأخیرات و خسارات", en: "Delay & loss linkage" },
  { no: 18, fa: "روند، سوابق و پیوست‌ها", en: "Trend, history & annexes" },
];

export const RISK_DOC_TABLES: { no: number; chapter: number; fa: string; dataset: string }[] = [
  { no: 1, chapter: 1, fa: "مشخصات سند", dataset: "docMeta" }, { no: 2, chapter: 1, fa: "وضعیت و نسخه گزارش", dataset: "docStatus" },
  { no: 3, chapter: 2, fa: "قراردادهای پروژه", dataset: "contracts" }, { no: 4, chapter: 2, fa: "الحاقیه‌ها و اصلاحیه‌ها", dataset: "amendments" }, { no: 5, chapter: 2, fa: "پوشش قراردادی ریسک‌ها", dataset: "contractCoverage" },
  { no: 6, chapter: 3, fa: "شاخص‌های کلیدی", dataset: "kpis" }, { no: 7, chapter: 3, fa: "توزیع رتبه ذاتی", dataset: "inherentDist" }, { no: 8, chapter: 3, fa: "توزیع رتبه باقیمانده", dataset: "residualDist" },
  { no: 9, chapter: 4, fa: "پارامترهای روش امتیازدهی", dataset: "methodParams" }, { no: 10, chapter: 4, fa: "وزن ابعاد اثر", dataset: "impactWeights" }, { no: 11, chapter: 4, fa: "آستانه‌های رتبه‌بندی", dataset: "bandThresholds" },
  { no: 12, chapter: 5, fa: "همه ریسک‌های ثبت‌شده", dataset: "risksAll" }, { no: 13, chapter: 5, fa: "ریسک‌های باز", dataset: "risksOpen" }, { no: 14, chapter: 5, fa: "ریسک‌های بسته و در پایش", dataset: "risksClosed" }, { no: 15, chapter: 5, fa: "ارزیابی‌نشده و فاقد مالک", dataset: "risksGaps" },
  { no: 16, chapter: 6, fa: "ریسک‌های بحرانی", dataset: "risksCritical" }, { no: 17, chapter: 6, fa: "ریسک‌های بالا", dataset: "risksHigh" },
  { no: 18, chapter: 7, fa: "ماتریس ۵×۵ احتمال و اثر", dataset: "matrix" }, { no: 19, chapter: 7, fa: "توزیع احتمال وقوع", dataset: "probDist" },
  { no: 20, chapter: 8, fa: "ابعاد اثر هر ریسک", dataset: "impactDims" }, { no: 21, chapter: 8, fa: "تجمیع ریسک به تفکیک دسته", dataset: "byCategory" }, { no: 22, chapter: 8, fa: "تجمیع ریسک به تفکیک قرارداد", dataset: "byContract" },
  { no: 23, chapter: 9, fa: "کنترل‌های موجود", dataset: "controls" }, { no: 24, chapter: 9, fa: "اثربخشی کنترل‌ها", dataset: "controlEffect" }, { no: 25, chapter: 9, fa: "کنترل‌های ناکافی", dataset: "controlWeak" },
  { no: 26, chapter: 10, fa: "باقیمانده‌های بالا و بحرانی", dataset: "residualHigh" }, { no: 27, chapter: 10, fa: "مقایسه ذاتی و باقیمانده", dataset: "inherentVsResidual" },
  { no: 28, chapter: 11, fa: "همه تعهدات", dataset: "obligationsAll" }, { no: 29, chapter: 11, fa: "تعهدات نزدیک موعد", dataset: "obligationsSoon" },
  { no: 30, chapter: 12, fa: "تعهدات سررسیدگذشته", dataset: "obligationsOverdue" },
  { no: 31, chapter: 13, fa: "اقدامات به تفکیک راهبرد", dataset: "actionsByStrategy" }, { no: 32, chapter: 13, fa: "اقدامات باز", dataset: "actionsOpen" }, { no: 33, chapter: 13, fa: "اقدامات انجام‌شده", dataset: "actionsDone" },
  { no: 34, chapter: 14, fa: "اقدامات معوق", dataset: "actionsOverdue" }, { no: 35, chapter: 14, fa: "اقدامات بی‌اثر و نیازمند جایگزین", dataset: "actionsIneffective" },
  { no: 36, chapter: 15, fa: "همه یافته‌های تحلیل بند", dataset: "findingsAll" }, { no: 37, chapter: 15, fa: "یافته‌های در انتظار بررسی", dataset: "findingsPending" }, { no: 38, chapter: 15, fa: "یافته‌های پذیرفته‌شده", dataset: "findingsAccepted" }, { no: 39, chapter: 15, fa: "ابهام‌ها و فقدان معیار", dataset: "findingsAmbiguity" },
  { no: 40, chapter: 16, fa: "همه پیشنهادهای اصلاح", dataset: "improvementsAll" }, { no: 41, chapter: 16, fa: "پیشنهادهای در انتظار تأیید", dataset: "improvementsPending" }, { no: 42, chapter: 16, fa: "پیشنهادهای مصوب و ردشده", dataset: "improvementsDecided" },
  { no: 43, chapter: 17, fa: "پیوند با رویدادهای تأخیر", dataset: "delayLinks" }, { no: 44, chapter: 17, fa: "پیوند با پرونده‌های خسارت", dataset: "claimLinks" }, { no: 45, chapter: 17, fa: "ریسک‌های بدون پیوند", dataset: "unlinked" }, { no: 46, chapter: 17, fa: "وضعیت بررسی پیوندها", dataset: "linkReview" },
  { no: 47, chapter: 18, fa: "روند امتیاز ریسک", dataset: "trend" }, { no: 48, chapter: 18, fa: "سوابق ارزیابی‌ها", dataset: "assessmentHistory" }, { no: 49, chapter: 18, fa: "نسخه‌های روش امتیازدهی در سوابق", dataset: "methodVersions" }, { no: 50, chapter: 18, fa: "فهرست منابع و پیوست‌های اسنادی", dataset: "annexSources" }, { no: 51, chapter: 18, fa: "تصمیم‌های لازم", dataset: "decisions" },
];
export const RISK_DOC_TEMPLATE = { chapters: RISK_DOC_CHAPTERS, tables: RISK_DOC_TABLES } as const;

/** Auto-Cleanup خروجی رسمی: حذف راهنمای داخلی، برچسب‌های الزامی/اختیاری، هایلایت زرد و تثبیت فونت B Nazanin. */
export function sanitizeContractRiskDocumentHtml(html: string): string {
  return html
    .replace(/<section[^>]*data-internal="true"[\s\S]*?<\/section>/g, "")
    .replace(/<div class="internal-guide"[\s\S]*?<\/div>/g, "")
    .replace(/\s*[\[(【](الزامی|اختیاری|Required|Optional)[\])】]/g, "")
    .replace(/background(?:-color)?\s*:\s*(?:#ff0(?:000)?|#ffff00|yellow)\s*;?/gi, "")
    .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, "$1")
    .replace(/font-family\s*:[^;}]+/gi, "font-family: 'B Nazanin', Tahoma, sans-serif");
}

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
const KIND_FA: Record<string, string> = { payment: "شرط پرداخت", deadline: "مهلت", extension: "تمدید مدت", suspension: "تعلیق", termination: "خاتمه/فسخ", guarantee: "ضمانت‌نامه", insurance: "بیمه", liability: "مسئولیت", variation: "تغییر مقادیر", obligation_employer: "تعهد کارفرما", obligation_contractor: "تعهد پیمانکار", ambiguity: "ابهام", missing_criteria: "فقدان معیار" };
const catFa = (code: string, cats: { code: string; labelFa: string }[]) => cats.find((c) => c.code === code)?.labelFa ?? code;
const table = (caption: string, heads: string[], rows: string[][]): string =>
  `<table><caption>${esc(caption)}</caption><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}">داده‌ای ثبت نشده است</td></tr>`}</tbody></table>`;

export type ContractRiskReportInput = {
  projectId: string;
  scope: "all" | "critical";
  contractCode?: string | null;
  category?: string | null;
  categories?: { code: string; labelFa: string }[];
  risks: Row[]; actions: Row[]; obligations: Row[]; improvements: Row[]; findings: Row[];
  assessments: Row[]; contracts: Row[]; amendments: Row[];
  links: { delayEvents: Row[]; claims: Row[] };
  generatedAt: string; generatedBy?: string; scoringVersionNote: string;
};

export function buildContractRiskReport(input: ContractRiskReportInput) {
  const cats = input.categories ?? [];
  const today = input.generatedAt.slice(0, 10);
  const soon = new Date(new Date(today).getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const pendingFindings = input.findings.filter((f) => f.ReviewStatus === "pending").length;
  const fullSummary = summarizeContractRiskPortfolio(input.risks as ContractRiskLike[], input.actions, input.obligations, input.improvements, pendingFindings, today);

  let risks = input.risks;
  if (input.contractCode) risks = risks.filter((r) => r.ContractCode === input.contractCode);
  if (input.category) risks = risks.filter((r) => r.Category === input.category);
  const scoped = input.scope === "critical" ? risks.filter((r) => r.InherentBand === "critical" || r.InherentBand === "high") : risks;
  const summary = summarizeContractRiskPortfolio(scoped as ContractRiskLike[], input.actions, input.obligations, input.improvements, pendingFindings, today);

  const riskHeads = ["کد", "عنوان", "دسته", "قرارداد", "بند منشأ", "مالک", "احتمال", "ذاتی", "رتبه", "باقیمانده", "رتبه نهایی", "وضعیت"];
  const riskRow = (r: Row) => [esc(r.Code), esc(r.TitleFa), esc(catFa(r.Category, cats)), esc(r.ContractCode), esc(r.ClauseRef), esc(r.Owner), num(r.Probability), num(r.InherentScore), esc(BAND_FA[r.InherentBand] ?? "—"), num(r.ResidualScore), esc(BAND_FA[r.ResidualBand] ?? "—"), esc(r.Status)];
  const overdueObligations = input.obligations.filter((o) => o.Status === "pending" && o.DueDate && o.DueDate < today);
  const overdueActions = input.actions.filter((a) => a.Status !== "done" && a.Status !== "cancelled" && a.DueDate && a.DueDate < today);
  const actHeads = ["کد", "ریسک", "راهبرد", "اقدام", "مجری", "موعد", "پیشرفت", "وضعیت"];
  const actRow = (a: Row) => [esc(a.Code), esc(a.RiskCode), esc(STRAT_FA[a.Strategy] ?? a.Strategy), esc(a.TitleFa), esc(a.Owner), faDate(a.DueDate), num(a.ProgressPct) + "٪", esc(a.Status)];
  const oblHeads = ["کد", "تعهد", "قرارداد", "بند", "مسئول", "موعد", "وضعیت", "ریسک"];
  const oblRow = (o: Row) => [esc(o.Code), esc(o.TitleFa), esc(o.ContractCode), esc(o.ClauseRef), esc(o.ResponsibleParty), faDate(o.DueDate), esc(o.Status), esc(o.RiskCode)];
  const findHeads = ["بند", "نوع", "یافته", "اطمینان", "منبع", "بررسی"];
  const findRow = (f: Row) => [esc(f.ClauseNo), esc(KIND_FA[f.Kind] ?? f.Kind), esc(f.FindingFa), num(f.Confidence), esc(f.SourceRef), esc(f.ReviewStatus)];
  const impHeads = ["کد", "بند", "مشکل", "ریسک مرتبط", "وضعیت", "بازبین"];
  const impRow = (i: Row) => [esc(i.Code), esc(i.ClauseRef), esc(i.ProblemFa), esc(i.RiskCode), esc(i.Status), esc(i.ReviewerBy)];

  const byKey = (rows: Row[], key: (r: Row) => string) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) { const k = key(r); m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()];
  };
  const bandDist = (key: "InherentBand" | "ResidualBand") => (["critical", "high", "medium", "low"] as const).map((b) => [BAND_FA[b], String(scoped.filter((r) => r[key] === b).length), String(scoped.length ? Math.round((scoped.filter((r) => r[key] === b).length / scoped.length) * 100) : 0) + "٪"]);

  const T: Record<string, string> = {
    docMeta: table("جدول ۱- مشخصات سند", ["مشخصه", "مقدار"], [["پروژه", esc(input.projectId)], ["عنوان", "گزارش ریسک‌های قراردادی و بهبود قرارداد (PMO-CONTRACT-RISK-ENGINE-V1.0)"], ["دامنه", input.scope === "critical" ? "ریسک‌های بحرانی و بالا" : "جامع"], ["قرارداد", esc(input.contractCode)], ["دسته", esc(input.category)], ["تاریخ تهیه", faDate(today)], ["تهیه‌کننده", esc(input.generatedBy)]]),
    docStatus: table("جدول ۲- وضعیت و نسخه گزارش", ["مشخصه", "مقدار"], [["وضعیت سند", "پیش‌نویس تا تأیید مسئول مربوط"], ["روش امتیازدهی", esc(input.scoringVersionNote)], ["استاندارد سند", "۱۸ فصل و ۵۱ جدول"], ["قاعده نمایش داده ناقص", "—"]]),
    contracts: table("جدول ۳- قراردادهای پروژه", ["کد", "عنوان", "مبلغ", "واحد پول"], input.contracts.map((c) => [esc(c.Code), esc(c.TitleFa ?? c.NameFa), num(c.Amount), esc(c.Currency)])),
    amendments: table("جدول ۴- الحاقیه‌ها و اصلاحیه‌ها", ["کد", "عنوان", "تاریخ اثر", "تغییر مبلغ", "تغییر مدت (روز)"], input.amendments.map((a) => [esc(a.Code), esc(a.TitleFa), faDate(a.EffectiveDate), num(a.AmountDelta), num(a.DurationDeltaDays)])),
    contractCoverage: table("جدول ۵- پوشش قراردادی ریسک‌ها", ["قرارداد", "ریسک‌های منتسب", "بحرانی/بالا"], byKey(scoped, (r) => r.ContractCode ?? "بدون قرارداد").map(([k, v]) => [esc(k), String(v.length), String(v.filter((r) => r.InherentBand === "critical" || r.InherentBand === "high").length)])),
    kpis: table("جدول ۶- شاخص‌های کلیدی", ["شاخص", "مقدار"], [["کل ریسک‌ها", num(fullSummary.totalRisks)], ["بحرانی (ذاتی)", num(fullSummary.critical)], ["بالا", num(fullSummary.high)], ["متوسط", num(fullSummary.medium)], ["پایین", num(fullSummary.low)], ["ارزیابی‌نشده", num(fullSummary.unassessed)], ["فاقد مالک", num(fullSummary.ownerless)], ["کنترل ناکافی", num(fullSummary.inadequateControl)], ["باقیمانده بحرانی", num(fullSummary.residualCritical)], ["اقدامات معوق", num(fullSummary.overdueActions)], ["تعهدات سررسیدگذشته", num(fullSummary.overdueObligations)], ["پیشنهاد در انتظار تأیید", num(fullSummary.improvementsPendingApproval)], ["ریسک مرتبط با ادعای فعال", num(fullSummary.linkedActiveClaims)]]),
    inherentDist: table("جدول ۷- توزیع رتبه ذاتی", ["رتبه", "تعداد", "سهم"], bandDist("InherentBand")),
    residualDist: table("جدول ۸- توزیع رتبه باقیمانده", ["رتبه", "تعداد", "سهم"], bandDist("ResidualBand")),
    methodParams: table("جدول ۹- پارامترهای روش امتیازدهی", ["پارامتر", "مقدار"], [["نسخه روش", esc(DEFAULT_SCORING_CONFIG.version)], ["مقیاس احتمال", "۱ تا ۵ (بسیار کم تا بسیار زیاد)"], ["مقیاس اثر", "۱ تا ۵ در پنج بعد"], ["فرمول ذاتی", "احتمال × اثر وزن‌دار ابعاد"], ["قاعده باقیمانده", "کاهش فقط با اثربخشی کنترلِ دارای شاهد اجرایی"]]),
    impactWeights: table("جدول ۱۰- وزن ابعاد اثر", ["بعد اثر", "وزن"], [["زمانی", num(DEFAULT_SCORING_CONFIG.impactWeights.time)], ["مالی", num(DEFAULT_SCORING_CONFIG.impactWeights.financial)], ["حقوقی و قراردادی", num(DEFAULT_SCORING_CONFIG.impactWeights.legal)], ["عملیاتی و منابع", num(DEFAULT_SCORING_CONFIG.impactWeights.operational)], ["کیفیت و الزامات", num(DEFAULT_SCORING_CONFIG.impactWeights.quality)]]),
    bandThresholds: table("جدول ۱۱- آستانه‌های رتبه‌بندی", ["رتبه", "آستانه امتیاز"], [["بحرانی", "≥ " + DEFAULT_SCORING_CONFIG.bands.critical], ["بالا", "≥ " + DEFAULT_SCORING_CONFIG.bands.high], ["متوسط", "≥ " + DEFAULT_SCORING_CONFIG.bands.medium], ["پایین", "< " + DEFAULT_SCORING_CONFIG.bands.medium]]),
    risksAll: table("جدول ۱۲- همه ریسک‌های ثبت‌شده", riskHeads, scoped.map(riskRow)),
    risksOpen: table("جدول ۱۳- ریسک‌های باز", riskHeads, scoped.filter((r) => r.Status !== "closed").map(riskRow)),
    risksClosed: table("جدول ۱۴- ریسک‌های بسته و در پایش", riskHeads, scoped.filter((r) => r.Status === "closed" || r.Status === "monitoring").map(riskRow)),
    risksGaps: table("جدول ۱۵- ارزیابی‌نشده و فاقد مالک", ["کد", "عنوان", "نقص"], scoped.filter((r) => r.InherentScore === null || r.InherentScore === undefined || !r.Owner).map((r) => [esc(r.Code), esc(r.TitleFa), esc((r.InherentScore === null || r.InherentScore === undefined ? "ارزیابی‌نشده " : "") + (!r.Owner ? "فاقد مالک" : ""))])),
    risksCritical: table("جدول ۱۶- ریسک‌های بحرانی", riskHeads, scoped.filter((r) => r.InherentBand === "critical").map(riskRow)),
    risksHigh: table("جدول ۱۷- ریسک‌های بالا", riskHeads, scoped.filter((r) => r.InherentBand === "high").map(riskRow)),
    matrix: table("جدول ۱۸- ماتریس ۵×۵ احتمال و اثر", ["احتمال \\ اثر", "۱", "۲", "۳", "۴", "۵"], [5, 4, 3, 2, 1].map((p) => [String(p), ...[1, 2, 3, 4, 5].map((i) => String(summary.matrix[`${p}x${i}`] ?? 0))])),
    probDist: table("جدول ۱۹- توزیع احتمال وقوع", ["احتمال", "تعداد"], [1, 2, 3, 4, 5].map((p) => [String(p), String(scoped.filter((r) => Number(r.Probability) === p).length)])),
    impactDims: table("جدول ۲۰- ابعاد اثر هر ریسک", ["کد", "عنوان", "زمانی", "مالی", "حقوقی", "عملیاتی", "کیفی"], scoped.map((r) => [esc(r.Code), esc(r.TitleFa), num(r.ImpactTime), num(r.ImpactFinancial), num(r.ImpactLegal), num(r.ImpactOperational), num(r.ImpactQuality)])),
    byCategory: table("جدول ۲۱- تجمیع به تفکیک دسته", ["دسته", "تعداد", "میانگین ذاتی"], byKey(scoped, (r) => catFa(r.Category, cats)).map(([k, v]) => [esc(k), String(v.length), num(v.reduce((s, r) => s + (Number(r.InherentScore) || 0), 0) / (v.filter((r) => r.InherentScore !== null && r.InherentScore !== undefined).length || 1))])),
    byContract: table("جدول ۲۲- تجمیع به تفکیک قرارداد", ["قرارداد", "تعداد", "میانگین ذاتی"], byKey(scoped, (r) => r.ContractCode ?? "بدون قرارداد").map(([k, v]) => [esc(k), String(v.length), num(v.reduce((s, r) => s + (Number(r.InherentScore) || 0), 0) / (v.filter((r) => r.InherentScore !== null && r.InherentScore !== undefined).length || 1))])),
    controls: table("جدول ۲۳- کنترل‌های موجود", ["کد", "عنوان", "کنترل موجود", "اثربخشی اعلامی"], scoped.map((r) => [esc(r.Code), esc(r.TitleFa), esc(r.ExistingControlsFa), esc(r.ControlEffectiveness)])),
    controlEffect: table("جدول ۲۴- اثربخشی کنترل‌ها", ["کد", "عنوان", "ذاتی", "باقیمانده", "کاهش"], scoped.map((r) => [esc(r.Code), esc(r.TitleFa), num(r.InherentScore), num(r.ResidualScore), num((Number(r.InherentScore) || 0) - (Number(r.ResidualScore) || 0))])),
    controlWeak: table("جدول ۲۵- کنترل‌های ناکافی", ["کد", "عنوان", "وضعیت کنترل"], scoped.filter((r) => !r.ControlEffectiveness || r.ControlEffectiveness === "none").map((r) => [esc(r.Code), esc(r.TitleFa), "بدون کنترل مؤثر مستند"])),
    residualHigh: table("جدول ۲۶- باقیمانده‌های بالا و بحرانی", riskHeads, scoped.filter((r) => r.ResidualBand === "critical" || r.ResidualBand === "high").map(riskRow)),
    inherentVsResidual: table("جدول ۲۷- مقایسه ذاتی و باقیمانده", ["کد", "عنوان", "ذاتی", "باقیمانده", "رتبه نهایی"], scoped.map((r) => [esc(r.Code), esc(r.TitleFa), num(r.InherentScore), num(r.ResidualScore), esc(BAND_FA[r.ResidualBand] ?? "—")])),
    obligationsAll: table("جدول ۲۸- همه تعهدات", oblHeads, input.obligations.map(oblRow)),
    obligationsSoon: table("جدول ۲۹- تعهدات نزدیک موعد (۳۰ روز)", oblHeads, input.obligations.filter((o) => o.Status === "pending" && o.DueDate && o.DueDate >= today && o.DueDate <= soon).map(oblRow)),
    obligationsOverdue: table("جدول ۳۰- تعهدات سررسیدگذشته", oblHeads, overdueObligations.map(oblRow)),
    actionsByStrategy: table("جدول ۳۱- اقدامات به تفکیک راهبرد", ["راهبرد", "تعداد", "انجام‌شده"], byKey(input.actions, (a) => STRAT_FA[a.Strategy] ?? a.Strategy).map(([k, v]) => [esc(k), String(v.length), String(v.filter((a) => a.Status === "done").length)])),
    actionsOpen: table("جدول ۳۲- اقدامات باز", actHeads, input.actions.filter((a) => a.Status !== "done" && a.Status !== "cancelled").map(actRow)),
    actionsDone: table("جدول ۳۳- اقدامات انجام‌شده", actHeads, input.actions.filter((a) => a.Status === "done").map(actRow)),
    actionsOverdue: table("جدول ۳۴- اقدامات معوق", actHeads, overdueActions.map(actRow)),
    actionsIneffective: table("جدول ۳۵- اقدامات بی‌اثر و نیازمند جایگزین", ["کد", "ریسک", "اقدام", "یادداشت اثربخشی"], input.actions.filter((a) => a.Status === "ineffective").map((a) => [esc(a.Code), esc(a.RiskCode), esc(a.TitleFa), esc(a.EffectivenessNoteFa)])),
    findingsAll: table("جدول ۳۶- همه یافته‌های تحلیل بند", findHeads, input.findings.map(findRow)),
    findingsPending: table("جدول ۳۷- یافته‌های در انتظار بررسی", findHeads, input.findings.filter((f) => f.ReviewStatus === "pending").map(findRow)),
    findingsAccepted: table("جدول ۳۸- یافته‌های پذیرفته‌شده", findHeads, input.findings.filter((f) => f.ReviewStatus === "accepted").map(findRow)),
    findingsAmbiguity: table("جدول ۳۹- ابهام‌ها و فقدان معیار", findHeads, input.findings.filter((f) => f.Kind === "ambiguity" || f.Kind === "missing_criteria").map(findRow)),
    improvementsAll: table("جدول ۴۰- همه پیشنهادهای اصلاح", impHeads, input.improvements.map(impRow)),
    improvementsPending: table("جدول ۴۱- پیشنهادهای در انتظار تأیید", impHeads, input.improvements.filter((i) => i.Status === "pending_approval" || i.Status === "needs_review").map(impRow)),
    improvementsDecided: table("جدول ۴۲- پیشنهادهای مصوب و ردشده", impHeads, input.improvements.filter((i) => i.Status === "approved" || i.Status === "rejected").map(impRow)),
    delayLinks: table("جدول ۴۳- پیوند با رویدادهای تأخیر", ["ریسک", "رویداد تأخیر", "عنوان رویداد", "وضعیت رویداد"], scoped.filter((r) => r.DelayEventCode).map((r) => { const d = input.links.delayEvents.find((x) => x.code === r.DelayEventCode); return [esc(r.Code), esc(r.DelayEventCode), esc(d?.titleFa), esc(d?.status ?? "در ماژول تأخیرات یافت نشد")]; })),
    claimLinks: table("جدول ۴۴- پیوند با پرونده‌های خسارت", ["ریسک", "پرونده", "وضعیت پرونده", "مبلغ ثبت‌شده", "مبلغ تأییدشده"], scoped.filter((r) => r.ClaimCode).map((r) => { const c = input.links.claims.find((x) => x.code === r.ClaimCode); return [esc(r.Code), esc(r.ClaimCode), esc(c?.status ?? "در ماژول خسارت یافت نشد"), num(c?.amount), num(c?.approvedAmount)]; })),
    unlinked: table("جدول ۴۵- ریسک‌های بدون پیوند تأخیر/خسارت", ["کد", "عنوان", "دسته"], scoped.filter((r) => !r.DelayEventCode && !r.ClaimCode).map((r) => [esc(r.Code), esc(r.TitleFa), esc(catFa(r.Category, cats))])),
    linkReview: table("جدول ۴۶- وضعیت بررسی پیوندها", ["ریسک", "پیوند تأخیر معتبر", "پیوند خسارت معتبر", "توضیح"], scoped.filter((r) => r.DelayEventCode || r.ClaimCode).map((r) => [esc(r.Code), esc(r.DelayEventCode ? (input.links.delayEvents.some((d) => d.code === r.DelayEventCode) ? "بله" : "یافت نشد") : "—"), esc(r.ClaimCode ? (input.links.claims.some((c) => c.code === r.ClaimCode) ? "بله" : "یافت نشد") : "—"), "پیوند صرفاً با کد مشترک است؛ وقوع خسارت یا استحقاق را ثابت نمی‌کند"])),
    trend: table("جدول ۴۷- روند امتیاز ریسک", ["ریسک", "تاریخ", "ذاتی", "باقیمانده"], [...input.assessments].sort((a, b) => String(a.AssessedAt).localeCompare(String(b.AssessedAt))).slice(-30).map((a) => [esc(a.RiskCode), faDate(a.AssessedAt), num(a.InherentScore), num(a.ResidualScore)])),
    assessmentHistory: table("جدول ۴۸- سوابق ارزیابی‌ها", ["ریسک", "تاریخ", "ذاتی", "رتبه", "باقیمانده", "رتبه نهایی", "ارزیاب"], [...input.assessments].sort((a, b) => String(b.AssessedAt).localeCompare(String(a.AssessedAt))).slice(0, 50).map((a) => [esc(a.RiskCode), faDate(a.AssessedAt), num(a.InherentScore), esc(BAND_FA[a.InherentBand] ?? "—"), num(a.ResidualScore), esc(BAND_FA[a.ResidualBand] ?? "—"), esc(a.AssessedBy)])),
    methodVersions: table("جدول ۴۹- نسخه‌های روش در سوابق", ["نسخه روش", "تعداد ارزیابی"], byKey(input.assessments, (a) => a.ScoringVersion ?? "—").map(([k, v]) => [esc(k), String(v.length)])),
    annexSources: table("جدول ۵۰- منابع و پیوست‌های اسنادی", ["نوع", "ارجاع", "توضیح"], [
      ...input.findings.slice(0, 30).map((f) => ["یافته بند", esc(f.SourceRef), esc(KIND_FA[f.Kind] ?? f.Kind)]),
      ...input.obligations.filter((o) => o.EvidenceDocumentId).slice(0, 20).map((o) => ["شاهد تعهد", esc(o.EvidenceDocumentId), esc(o.Code)]),
    ]),
    decisions: table("جدول ۵۱- تصمیم‌های لازم", ["موضوع", "شرح", "مرجع تصمیم"], [
      ...(fullSummary.critical > 0 ? [["ریسک بحرانی", `${fullSummary.critical} ریسک بحرانی نیازمند اقدام فوری است`, "مدیر پروژه"]] : []),
      ...(input.improvements.some((i) => i.Status === "pending_approval") ? [["پیشنهاد اصلاح", "پیشنهادهای در انتظار تأیید باید تعیین تکلیف شوند", "مدیر پروژه / کارفرما"]] : []),
      ...(overdueActions.length ? [["اقدام معوق", `${overdueActions.length} اقدام پاسخ از موعد گذشته است`, "مالکان اقدام"]] : []),
      ...(input.findings.some((f) => f.ReviewStatus === "pending") ? [["یافته تحلیل", "یافته‌های تحلیل بند در انتظار بررسی کارشناس‌اند", "مدیر پیمان"]] : []),
    ]),
  };

  const tablesByChapter = new Map<number, string[]>();
  for (const t of RISK_DOC_TABLES) tablesByChapter.set(t.chapter, [...(tablesByChapter.get(t.chapter) ?? []), T[t.dataset]]);
  const chaptersHtml = RISK_DOC_CHAPTERS.map((ch) =>
    `<h2>فصل ${ch.no}: ${esc(ch.fa)}</h2>` + (tablesByChapter.get(ch.no) ?? []).join("\n"),
  ).join("\n");

  const raw = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>گزارش ریسک قراردادی</title>
<style>@page { margin: 2cm; } body { font-family: Tahoma, sans-serif; font-size: 12pt; line-height: 1.9; color: #111; } h1 { font-size: 17pt; text-align: center; } h2 { font-size: 14pt; border-bottom: 2px solid #0f4c5c; padding-bottom: 4px; margin-top: 28px; } table { width: 100%; border-collapse: collapse; margin: 10px 0; } caption { text-align: right; font-weight: bold; padding: 4px 0; } th { background: #0f4c5c; color: #fff; padding: 6px; font-size: 10.5pt; } td { border: 1px solid #bbb; padding: 5px; font-size: 10.5pt; } .meta { text-align: center; color: #444; } .hl { background: #ffff00; }</style></head>
<body>
<section data-internal="true"><h2>راهنمای داخلی تولید گزارش [الزامی]</h2><p>این بخش راهنمای داخلی است و نباید در خروجی رسمی دیده شود. برچسب‌های [الزامی] و [اختیاری] و <mark>هایلایت زرد</mark> نمونه‌اند و در Auto-Cleanup حذف/شفاف می‌شوند.</p></section>
<h1>گزارش ${input.scope === "critical" ? "ریسک‌های بحرانی و بالا" : "جامع"} ریسک‌های قراردادی و بهبود قرارداد</h1>
<p class="meta">پروژه: ${esc(input.projectId)} · تاریخ تهیه: ${faDate(today)} · PMO-CONTRACT-RISK-ENGINE-V1.0</p>
${chaptersHtml}
<p>امتیاز ریسک صرفاً ابزار اولویت‌بندی است و به‌تنهایی وقوع خسارت، استحقاق مالی یا مدت تمدید را اثبات نمی‌کند؛ هیچ مبلغی بر اساس امتیاز ریسک محاسبه یا به پرونده خسارت منتقل نشده است.</p>
</body></html>`;

  return {
    body: sanitizeContractRiskDocumentHtml(raw),
    filename: `contract-risk-report-${input.scope}.doc`,
    contentType: "application/msword; charset=utf-8",
    issues: [] as string[],
    chapterCount: RISK_DOC_CHAPTERS.length,
    tableCount: RISK_DOC_TABLES.length,
  };
}
