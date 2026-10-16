/**
 * ClaimLossDocumentGenerator — لایحهٔ ضرر و زیان پیمان (PMO-CLAIMS-LOSS-ENGINE-V1.0).
 * استاندارد صنعتی سند: دقیقاً ۱۸ فصل و ۵۱ جدول (LOSS_DOC_TABLES).
 * Auto-Cleanup هنگام صدور: صفحات/بخش‌های راهنمای داخلی حذف، برچسب‌های
 * «الزامی/اختیاری» پاک، هایلایت‌های زرد شفاف و فونت رسمی B Nazanin اعمال می‌شود.
 * سند تا تأیید مسئول مربوط «پیش‌نویس» است؛ دادهٔ ناقص «—» چاپ می‌شود و عددی حدس زده نمی‌شود.
 */
import { lossCategoryFa, type LossSummary } from './claimLoss';

export const LOSS_DOC_CHAPTERS: { no: number; fa: string; en: string }[] = [
  { no: 1, fa: 'صفحه عنوان', en: 'Cover page' }, { no: 2, fa: 'مشخصات پروژه و قرارداد', en: 'Project & contract' },
  { no: 3, fa: 'خلاصه مدیریتی', en: 'Executive summary' }, { no: 4, fa: 'موضوع و مبنای ادعا', en: 'Subject & basis' },
  { no: 5, fa: 'شرح رویدادهای خسارت', en: 'Loss events' }, { no: 6, fa: 'خط زمانی رویدادها', en: 'Timeline' },
  { no: 7, fa: 'مبانی قراردادی', en: 'Contractual basis' }, { no: 8, fa: 'روش محاسبه هر دسته خسارت', en: 'Method per category' },
  { no: 9, fa: 'جداول تفصیلی محاسبات', en: 'Detailed calculations' }, { no: 10, fa: 'اسناد و شواهد پشتیبان', en: 'Evidence' },
  { no: 11, fa: 'ارتباط خسارت با تأخیرات', en: 'Link to delays' }, { no: 12, fa: 'محاسبات مربوط به صورت‌وضعیت‌ها', en: 'Statement calculations' },
  { no: 13, fa: 'کنترل هم‌پوشانی و جلوگیری از مطالبه تکراری', en: 'Overlap control' }, { no: 14, fa: 'جمع‌بندی مبالغ', en: 'Amounts summary' },
  { no: 15, fa: 'محدودیت‌ها و فرضیات', en: 'Limitations & assumptions' }, { no: 16, fa: 'مبلغ پیشنهادی مطالبه', en: 'Proposed amount' },
  { no: 17, fa: 'نتیجه بررسی کارشناسی', en: 'Expert review' }, { no: 18, fa: 'فهرست پیوست‌ها', en: 'Annexes' },
];

type TableDataset = string;
export const LOSS_DOC_TABLES: { no: number; chapter: number; fa: string; dataset: TableDataset }[] = [
  { no: 1, chapter: 1, fa: 'مشخصات سند', dataset: 'docMeta' }, { no: 2, chapter: 1, fa: 'مشخصات پرونده', dataset: 'claim' },
  { no: 3, chapter: 2, fa: 'پروژه و قرارداد', dataset: 'project' }, { no: 4, chapter: 2, fa: 'وضعیت پرونده و طرفین', dataset: 'caseStatus' }, { no: 5, chapter: 2, fa: 'اسناد مبنای پرونده', dataset: 'basisDocs' },
  { no: 6, chapter: 3, fa: 'خلاصهٔ مبالغ', dataset: 'amounts' }, { no: 7, chapter: 3, fa: 'شاخص‌های پرونده', dataset: 'caseIndex' }, { no: 8, chapter: 3, fa: 'وضعیت آماده‌سازی لایحه', dataset: 'readiness' },
  { no: 9, chapter: 4, fa: 'موضوع ادعا', dataset: 'subject' }, { no: 10, chapter: 4, fa: 'مبنای استحقاق', dataset: 'entitlement' }, { no: 11, chapter: 4, fa: 'رابطهٔ سببیت', dataset: 'causation' },
  { no: 12, chapter: 5, fa: 'فهرست رویدادهای خسارت', dataset: 'events' }, { no: 13, chapter: 5, fa: 'شرح وقایع و علت ریشه‌ای', dataset: 'eventsDetail' }, { no: 14, chapter: 5, fa: 'طبقه‌بندی رویدادها', dataset: 'eventClasses' },
  { no: 15, chapter: 6, fa: 'خط زمانی رویدادها', dataset: 'timeline' }, { no: 16, chapter: 6, fa: 'خط زمانی اقلام خسارت', dataset: 'itemTimeline' },
  { no: 17, chapter: 7, fa: 'بندهای قراردادی مورد استناد', dataset: 'clauses' }, { no: 18, chapter: 7, fa: 'قواعد و منابع محاسباتی', dataset: 'rules' }, { no: 19, chapter: 7, fa: 'شرایط شمول و استثناها', dataset: 'ruleScope' },
  { no: 20, chapter: 8, fa: 'دسته‌های خسارت و روش محاسبه', dataset: 'categories' }, { no: 21, chapter: 8, fa: 'فرمول قواعد', dataset: 'formulas' }, { no: 22, chapter: 8, fa: 'نسخه و اعتبار قواعد', dataset: 'ruleVersions' },
  { no: 23, chapter: 9, fa: 'ریز اقلام خسارت', dataset: 'items' }, { no: 24, chapter: 9, fa: 'اجراهای محاسبه', dataset: 'runs' }, { no: 25, chapter: 9, fa: 'ورودی‌های اجراها', dataset: 'runInputs' }, { no: 26, chapter: 9, fa: 'اصلاحات دستی و سوابق آن', dataset: 'adjustments' }, { no: 27, chapter: 9, fa: 'منابع نیروی انسانی و ماشین‌آلات', dataset: 'resources' },
  { no: 28, chapter: 10, fa: 'فهرست اسناد پشتیبان', dataset: 'docs' }, { no: 29, chapter: 10, fa: 'اسناد به تفکیک قلم', dataset: 'docsByItem' }, { no: 30, chapter: 10, fa: 'مدارک ناقص', dataset: 'missingDocs' },
  { no: 31, chapter: 11, fa: 'رویدادهای تأخیر پیوندشده', dataset: 'linkedEvents' }, { no: 32, chapter: 11, fa: 'اثر بر تاریخ اتمام', dataset: 'completionImpact' }, { no: 33, chapter: 11, fa: 'هم‌پوشانی دوره‌ای رویدادها', dataset: 'overlapsPeriod' },
  { no: 34, chapter: 12, fa: 'نتایج تأخیر پرداخت (زمانی)', dataset: 'paymentCalcs' }, { no: 35, chapter: 12, fa: 'قواعد مالی و نرخ‌های مستند', dataset: 'financialRules' }, { no: 36, chapter: 12, fa: 'تفکیک مدت تأخیر و مبلغ خسارت', dataset: 'dayVsMoney' },
  { no: 37, chapter: 13, fa: 'هشدارهای هم‌پوشانی', dataset: 'overlapWarnings' }, { no: 38, chapter: 13, fa: 'تخصیص هزینه میان رویدادها', dataset: 'allocations' }, { no: 39, chapter: 13, fa: 'کنترل سقف تخصیص ۱۰۰٪', dataset: 'allocControl' },
  { no: 40, chapter: 14, fa: 'تفکیک مبالغ پرونده', dataset: 'amounts' }, { no: 41, chapter: 14, fa: 'جمع مبالغ به تفکیک دسته', dataset: 'amountsByCategory' }, { no: 42, chapter: 14, fa: 'جمع مبالغ به تفکیک رویداد', dataset: 'amountsByEvent' },
  { no: 43, chapter: 15, fa: 'فرضیات محاسبات', dataset: 'assumptions' }, { no: 44, chapter: 15, fa: 'محدودیت‌ها', dataset: 'limitations' },
  { no: 45, chapter: 16, fa: 'مبلغ پیشنهادی مطالبه', dataset: 'proposed' }, { no: 46, chapter: 16, fa: 'مبنای مبلغ پیشنهادی', dataset: 'proposedBasis' },
  { no: 47, chapter: 17, fa: 'وضعیت بررسی اقلام', dataset: 'reviewStatus' }, { no: 48, chapter: 17, fa: 'قواعد تأییدنشده و اقلام نیازمند بررسی', dataset: 'unapprovedRules' }, { no: 49, chapter: 17, fa: 'تصمیم‌های لازم', dataset: 'decisions' },
  { no: 50, chapter: 18, fa: 'پیوست‌های اسنادی', dataset: 'annexDocs' }, { no: 51, chapter: 18, fa: 'سوابق نسخه‌های لایحه', dataset: 'docVersions' },
];
export const LOSS_DOC_TEMPLATE = { chapters: LOSS_DOC_CHAPTERS, tables: LOSS_DOC_TABLES } as const;

/** Auto-Cleanup خروجی رسمی: حذف راهنمای داخلی، برچسب‌های الزامی/اختیاری، هایلایت زرد و تثبیت فونت B Nazanin. */
export function sanitizeLossDocumentHtml(html: string): string {
  return html
    .replace(/<div class="internal-guide"[\s\S]*?<\/div>/g, '')
    .replace(/<section[^>]*data-internal="true"[\s\S]*?<\/section>/g, '')
    .replace(/<p[^>]*>[^<]*(?:راهنمای داخلی|Internal guide)[^<]*<\/p>/g, '')
    .replace(/\s*[\[(【](الزامی|اختیاری|Required|Optional)[\])】]/g, '')
    .replace(/background(?:-color)?\s*:\s*(?:#ff0(?:000)?|#ffff00|yellow)\s*;?/gi, '')
    .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
    .replace(/\sclass="hl"/g, '');
}

type Row = Record<string, unknown>;
const esc = (v: unknown): string => String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const faNum = (v: unknown): string => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
};
const faDate = (v: unknown): string => {
  const s = String(v ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s + 'T00:00:00')); } catch { return s; }
};
const table = (heads: string[], rows: string[][]): string =>
  `<table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}">—</td></tr>`}</tbody></table>`;

export type LossDocInput = {
  projectId: string; claim: Row; delayEvents: Row[]; costItems: Row[];
  runs: Row[]; rules: Row[]; allocations: Row[]; overlapWarnings: { kind: string; severity: string; messageFa: string }[];
  lossSummary: LossSummary | null; documentById: Map<string, Row>;
  version: number; format: 'word' | 'pdf'; generatedAt: string; generatedBy?: string;
  documentVersions?: Row[];
};

export function buildClaimLossDocument(input: LossDocInput) {
  const issues: string[] = [];
  const claim = input.claim;
  if (!claim?.Code) issues.push('ادعای معتبر برای تهیهٔ لایحه انتخاب نشده است');
  if (!input.costItems.length) issues.push('برای این پرونده هیچ قلم خسارتی ثبت نشده است؛ لایحه بدون جدول محاسبات صادر نمی‌شود');
  const caseAmounts = input.lossSummary?.cases.find(c => c.claimCode === String(claim?.Code ?? ''));
  const latestRunByItem = new Map<string, Row>();
  for (const run of [...input.runs].sort((a, b) => String(a.CalculatedAt ?? '').localeCompare(String(b.CalculatedAt ?? '')))) latestRunByItem.set(String(run.ClaimCostItemId), run);
  const eventById = new Map(input.delayEvents.map(e => [String(e.Id), e]));
  const docLabel = (id: unknown) => { const d = input.documentById.get(String(id)); return d ? `${esc(d.DocNo)}@${esc(d.Revision)}` : esc(id); };
  const itemDocs = (item: Row) => (Array.isArray(item.DocumentRefs) ? item.DocumentRefs : []) as unknown[];
  const calcOf = (item: Row) => { const run = latestRunByItem.get(String(item.Id)); return run && run.FinalAmount !== null && run.FinalAmount !== undefined ? faNum(run.FinalAmount) : 'نیازمند بررسی کارشناسی'; };

  const D: Record<string, { heads: string[]; rows: string[][] }> = {
    docMeta: { heads: ['مورد', 'مقدار'], rows: [['عنوان سند', 'لایحهٔ ضرر و زیان پیمان'], ['وضعیت سند', 'پیش‌نویس — تا تأیید مسئول مربوط سند نهایی نیست'], ['نسخهٔ لایحه', faNum(input.version)], ['تاریخ تولید', faDate(input.generatedAt)], ['تولیدکننده', esc(input.generatedBy ?? '—')]] },
    claim: { heads: ['مورد', 'مقدار'], rows: [['کد پرونده', esc(claim.Code)], ['عنوان', esc(claim.TitleFa)], ['وضعیت پرونده', esc(claim.Status)], ['تاریخ رویداد', faDate(claim.EventDate)], ['بند قراردادی', esc(claim.Clause)]] },
    project: { heads: ['مورد', 'مقدار'], rows: [['پروژه', esc(input.projectId)], ['کد ادعا', esc(claim.Code)], ['مرجع مستندات پرونده', esc(claim.EvidenceRef ?? '—')]] },
    caseStatus: { heads: ['شاخص', 'مقدار'], rows: [['وضعیت', esc(claim.Status)], ['تعداد رویدادهای پیوندشده', faNum(input.delayEvents.length)], ['تعداد اقلام خسارت', faNum(input.costItems.length)], ['تعداد اجراهای محاسبه', faNum(input.runs.length)]] },
    basisDocs: { heads: ['#', 'سند', 'نسخه', 'عنوان', 'وضعیت'], rows: [...input.documentById.values()].slice(0, 200).map((d, i) => [String(i + 1), esc(d.DocNo), esc(d.Revision), esc(d.TitleFa), esc(d.Status)]) },
    amounts: { heads: ['مبلغ', 'مقدار'], rows: caseAmounts ? [['برآورد اولیه', faNum(caseAmounts.estimated)], ['محاسبه‌شده', faNum(caseAmounts.calculated)], ['مستندشده', faNum(caseAmounts.documented)], ['پیشنهادی مطالبه', faNum(caseAmounts.proposed)], ['تأییدشدهٔ داخلی', faNum(caseAmounts.approvedInternal)], ['پذیرفته‌شدهٔ طرف مقابل', faNum(caseAmounts.accepted)], ['نهایی تعیین‌شده', faNum(caseAmounts.finalDetermined)]] : [] },
    caseIndex: { heads: ['شاخص', 'تعداد'], rows: [['اقلام خسارت', faNum(caseAmounts?.itemsCount)], ['اقلام بدون سند', faNum(caseAmounts?.itemsWithoutDocs)], ['اقلام نیازمند بررسی', faNum(caseAmounts?.itemsNeedingReview)], ['آمادهٔ تهیهٔ لایحه', caseAmounts?.readyForDocument ? 'بله' : 'خیر']] },
    readiness: { heads: ['کنترل', 'وضعیت'], rows: [['قلم خسارت ثبت شده', input.costItems.length ? 'بله' : 'خیر'], ['همهٔ اقلام محاسبهٔ نهایی دارند', caseAmounts && caseAmounts.itemsNeedingReview === 0 ? 'بله' : 'خیر'], ['وضعیت سند', 'پیش‌نویس']] },
    subject: { heads: ['مورد', 'شرح'], rows: [['عنوان پرونده', esc(claim.TitleFa)], ['موضوع', esc(claim.Entitlement ?? '—')]] },
    entitlement: { heads: ['مبنای استحقاق'], rows: [[esc(claim.Entitlement ?? '—')]] },
    causation: { heads: ['رابطهٔ سببیت'], rows: [[esc(claim.Causation ?? '—')]] },
    events: { heads: ['#', 'کد', 'عنوان', 'شروع', 'پایان', 'وضعیت'], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.TitleFa), faDate(e.StartDate), faDate(e.FinishDate), esc(e.Status)]) },
    eventsDetail: { heads: ['#', 'کد', 'علت ریشه‌ای', 'بند'], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.RootCauseFa ?? '—'), esc(e.ClauseRef ?? '—')]) },
    eventClasses: { heads: ['#', 'کد', 'طبقه‌بندی', 'طرف ایجادکننده', 'بحرانی'], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.Category), esc(e.SourceParty ?? '—'), e.IsCritical ? 'بله' : 'خیر']) },
    timeline: { heads: ['#', 'رویداد', 'از', 'تا'], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code) + ' — ' + esc(e.TitleFa), faDate(e.StartDate), faDate(e.FinishDate)]) },
    itemTimeline: { heads: ['#', 'قلم', 'از', 'تا'], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), faDate(item.PeriodFrom), faDate(item.PeriodTo)]) },
    clauses: { heads: ['بند', 'مرجع'], rows: [[esc(claim.Clause ?? '—'), esc(claim.EvidenceRef ?? '—')], ...input.delayEvents.map(e => [esc(e.ClauseRef ?? '—'), esc(e.Code)])] },
    rules: { heads: ['کد', 'نام', 'دسته', 'منبع', 'وضعیت'], rows: input.rules.map(r => [esc(r.Code), esc(r.NameFa), esc(lossCategoryFa(r.Category)), esc(r.SourceFa ?? '—'), esc(r.Status)]) },
    ruleScope: { heads: ['کد قاعده', 'شرح فرمول', 'شرایط شمول'], rows: input.rules.map(r => [esc(r.Code), esc(r.FormulaFa ?? '—'), r.Status === 'approved' ? 'تأییدشده و قابل اعمال' : 'تأییدنشده؛ مبنای قطعی نیست']) },
    categories: { heads: ['دسته', 'تعداد اقلام', 'روش'], rows: [...new Set(input.costItems.map(i => String(i.LossCategory ?? i.CostType)))].map(code => [esc(lossCategoryFa(code)), faNum(input.costItems.filter(i => String(i.LossCategory ?? i.CostType) === code).length), 'طبق قاعدهٔ تأییدشدهٔ جدول فرمول‌ها']) },
    formulas: { heads: ['کد قاعده', 'نوع فرمول', 'شرح'], rows: input.rules.map(r => [esc(r.Code), esc(r.Kind), esc(r.FormulaFa ?? '—')]) },
    ruleVersions: { heads: ['کد', 'نسخه', 'اعتبار از', 'تأییدکننده'], rows: input.rules.map(r => [esc(r.Code), esc(r.Version ?? '1.0'), faDate(r.EffectiveFrom), esc(r.ApprovedBy ?? '—')]) },
    items: { heads: ['#', 'قلم', 'دسته', 'ماهیت', 'دوره', 'ثبت‌شده', 'محاسبه‌شده', 'مستند', 'تأییدشده', 'اسناد'], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), esc(lossCategoryFa(item.LossCategory ?? item.CostType)), esc(item.CostNature === 'direct' ? 'مستقیم' : item.CostNature === 'indirect' ? 'غیرمستقیم' : '—'), faDate(item.PeriodFrom) + ' تا ' + faDate(item.PeriodTo), faNum(item.Amount), calcOf(item), faNum(item.DocumentedAmount), faNum(item.ApprovedAmount), itemDocs(item).map(docLabel).join('، ') || '—']) },
    runs: { heads: ['#', 'قلم', 'قاعده و نسخه', 'وضعیت', 'خام', 'نهایی', 'محاسبه‌کننده'], rows: input.costItems.map((item, i) => { const run = latestRunByItem.get(String(item.Id)); return run ? [String(i + 1), esc(item.TitleFa), esc(run.RuleCode ?? '—') + ' v' + esc(run.RuleVersion ?? '—'), run.Status === 'calculated' ? 'محاسبه‌شده' : 'نیازمند بررسی', faNum(run.RawAmount), faNum(run.FinalAmount), esc(run.CalculatedBy ?? '—')] : [String(i + 1), esc(item.TitleFa), '—', 'اجرا نشده', '—', '—', '—']; }) },
    runInputs: { heads: ['#', 'قلم', 'ورودی‌های ثبت‌شده'], rows: input.costItems.map((item, i) => { const run = latestRunByItem.get(String(item.Id)); let inputs = '—'; try { inputs = esc(typeof run?.Inputs === 'string' ? run.Inputs : JSON.stringify(run?.Inputs ?? '—')); } catch { inputs = '—'; } return [String(i + 1), esc(item.TitleFa), inputs]; }) },
    adjustments: { heads: ['#', 'قلم', 'اصلاح دستی', 'دلیل', 'کاربر'], rows: input.costItems.map((item, i) => { const run = latestRunByItem.get(String(item.Id)); return [String(i + 1), esc(item.TitleFa), faNum(run?.ManualAdjustment), esc(run?.ManualReason ?? '—'), esc(run?.CalculatedBy ?? '—')]; }) },
    resources: { heads: ['#', 'قلم', 'نوع منبع', 'نام منبع', 'کارکرد', 'توقف', 'مقدار × نرخ'], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), esc(item.ResourceKind ?? '—'), esc(item.ResourceNameFa ?? '—'), faNum(item.WorkedUnits), faNum(item.IdleUnits), faNum(item.Quantity) + ' × ' + faNum(item.Rate) + (item.UnitFa ? ' (' + esc(item.UnitFa) + ')' : '')]) },
    docs: { heads: ['پیوست', 'شماره', 'نسخه', 'عنوان', 'وضعیت', 'قلم مرتبط'], rows: input.costItems.flatMap(item => itemDocs(item).map(id => { const d = input.documentById.get(String(id)); return [esc(d?.DocNo ?? id), esc(d?.Revision ?? '—'), esc(d?.TitleFa ?? '—'), esc(d?.Status ?? '—'), esc(item.TitleFa)]; })).map((r, i) => [String(i + 1), ...r]) },
    docsByItem: { heads: ['#', 'قلم', 'تعداد اسناد', 'اسناد'], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), faNum(itemDocs(item).length), itemDocs(item).map(docLabel).join('، ') || '—']) },
    missingDocs: { heads: ['#', 'قلم فاقد سند', 'مبلغ ثبت‌شده'], rows: input.costItems.filter(item => !itemDocs(item).length).map((item, i) => [String(i + 1), esc(item.TitleFa), faNum(item.Amount)]) },
    linkedEvents: { heads: ['#', 'رویداد', 'ادعای مرتبط', 'وضعیت بررسی'], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code) + ' — ' + esc(e.TitleFa), esc(e.ClaimCode ?? '—'), esc(e.Status)]) },
    completionImpact: { heads: ['#', 'رویداد', 'اثر بر اتمام (روز)', 'برآورد تأخیر (روز)'], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), faNum(e.CompletionImpactDays), faNum(e.EstimatedDelayDays)]) },
    overlapsPeriod: { heads: ['#', 'هشدار دوره‌ای'], rows: input.overlapWarnings.filter(w => w.kind === 'duplicate_amount_period' || w.kind === 'overhead_overlap').map((w, i) => [String(i + 1), esc(w.messageFa)]) },
    paymentCalcs: { heads: ['#', 'قلم مرتبط با پرداخت', 'اجرا', 'وضعیت', 'مبلغ'], rows: input.costItems.filter(item => ['payment_delay', 'adjustment_delay'].includes(String(item.LossCategory ?? item.CostType))).map((item, i) => { const run = latestRunByItem.get(String(item.Id)); return [String(i + 1), esc(item.TitleFa), esc(run?.RuleCode ?? '—'), esc(run?.Status ?? '—'), faNum(run?.FinalAmount)]; }) },
    financialRules: { heads: ['کد قاعده', 'نوع', 'منبع', 'وضعیت'], rows: input.rules.filter(r => String(r.Kind) === 'daily_rate_days' || ['payment_delay', 'adjustment_delay'].includes(String(r.Category))).map(r => [esc(r.Code), esc(r.Kind), esc(r.SourceFa ?? '—'), esc(r.Status)]) },
    dayVsMoney: { heads: ['اصل کنترل', 'توضیح'], rows: [['مدت تأخیر (روز)', 'از محاسبات تأییدشدهٔ ماژول تأخیرات خوانده می‌شود و در جدول اثر بر اتمام آمده است'], ['مبلغ خسارت (پول)', 'فقط با قاعدهٔ مالی تأییدشده و نرخ مستند محاسبه می‌شود'], ['نتیجه', 'این دو خروجی هرگز خودکار معادل یکدیگر فرض نشده‌اند']] },
    overlapWarnings: { heads: ['#', 'شدت', 'هشدار'], rows: input.overlapWarnings.map((w, i) => [String(i + 1), w.severity === 'violation' ? 'نقض' : 'هشدار', esc(w.messageFa)]) },
    allocations: { heads: ['#', 'قلم', 'رویداد مقصد', 'درصد', 'مبنا'], rows: input.allocations.map((a, i) => [String(i + 1), esc(input.costItems.find(x => String(x.Id) === String(a.ClaimCostItemId))?.TitleFa ?? a.ClaimCostItemId), esc(eventById.get(String(a.DelayEventId))?.Code ?? a.DelayEventId), faNum(a.AllocationPct) + '٪', esc(a.Basis ?? '—')]) },
    allocControl: { heads: ['#', 'قلم', 'مجموع تخصیص'], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), faNum(input.allocations.filter(a => String(a.ClaimCostItemId) === String(item.Id)).reduce((s, a) => s + (Number(a.AllocationPct) || 0), 0)) + '٪']) },
    amountsByCategory: { heads: ['دسته', 'ثبت‌شده', 'محاسبه‌شده'], rows: [...new Set(input.costItems.map(i => String(i.LossCategory ?? i.CostType)))].map(code => { const list = input.costItems.filter(i => String(i.LossCategory ?? i.CostType) === code); return [esc(lossCategoryFa(code)), faNum(list.reduce((s, i) => s + (Number(i.Amount) || 0), 0)), faNum(list.reduce((s, i) => { const run = latestRunByItem.get(String(i.Id)); return s + (run && run.FinalAmount !== null && run.FinalAmount !== undefined ? Number(run.FinalAmount) : 0); }, 0))]; }) },
    amountsByEvent: { heads: ['رویداد', 'ثبت‌شده', 'محاسبه‌شده'], rows: input.delayEvents.map(e => { const list = input.costItems.filter(i => String(i.DelayEventId) === String(e.Id)); return [esc(e.Code), faNum(list.reduce((s, i) => s + (Number(i.Amount) || 0), 0)), faNum(list.reduce((s, i) => { const run = latestRunByItem.get(String(i.Id)); return s + (run && run.FinalAmount !== null && run.FinalAmount !== undefined ? Number(run.FinalAmount) : 0); }, 0))]; }) },
    assumptions: { heads: ['#', 'قلم', 'فرضیات/ورودی اجرا'], rows: input.costItems.map((item, i) => { const run = latestRunByItem.get(String(item.Id)); let v = '—'; try { v = esc(typeof run?.Inputs === 'string' ? run.Inputs : JSON.stringify(run?.Inputs ?? '—')); } catch { v = '—'; } return [String(i + 1), esc(item.TitleFa), v]; }) },
    limitations: { heads: ['محدودیت'], rows: [['قواعد تأییدنشده مبنای قطعی مطالبه نیستند و خروجی آن‌ها «نیازمند بررسی کارشناسی» است'], ['مدت تأخیر و مبلغ خسارت دو خروجی متفاوت‌اند و معادل‌سازی خودکار نشده است'], ['اقلام فاقد سند پشتیبان، مستند محسوب نمی‌شوند']] },
    proposed: { heads: ['مبلغ پیشنهادی مطالبه'], rows: [[caseAmounts ? '<mark>' + faNum(caseAmounts.proposed) + '</mark>' : '—']] },
    proposedBasis: { heads: ['مبنای پیشنهاد'], rows: [[esc(claim.QuantumNote ?? 'مبلغ پیشنهادی جدا از برآورد اولیه و مبالغ تأییدشده نگهداری می‌شود و بدون سابقه به آن‌ها تبدیل نشده است')]] },
    reviewStatus: { heads: ['#', 'قلم', 'وضعیت قلم', 'وضعیت آخرین اجرا'], rows: input.costItems.map((item, i) => { const run = latestRunByItem.get(String(item.Id)); return [String(i + 1), esc(item.TitleFa), esc(item.Status), esc(run?.Status ?? 'اجرا نشده')]; }) },
    unapprovedRules: { heads: ['کد', 'نام', 'وضعیت'], rows: input.rules.filter(r => r.Status !== 'approved').map(r => [esc(r.Code), esc(r.NameFa), esc(r.Status)]) },
    decisions: { heads: ['تصمیم لازم'], rows: [['تأیید یا رد قواعد نیازمند بررسی توسط کارشناس مستقل'], ['تعیین تکلیف اقلام فاقد سند یا محاسبهٔ نهایی'], ['تأیید نهایی این پیش‌نویس توسط مسئول مربوط پیش از صدور رسمی']] },
    annexDocs: { heads: ['پیوست', 'شماره', 'نسخه', 'عنوان'], rows: input.costItems.flatMap(item => itemDocs(item).map(id => { const d = input.documentById.get(String(id)); return [esc(d?.DocNo ?? id), esc(d?.Revision ?? '—'), esc(d?.TitleFa ?? '—')]; })).map((r, i) => [String(i + 1), ...r]) },
    docVersions: { heads: ['نسخه', 'قالب', 'وضعیت', 'تولیدکننده', 'تاریخ'], rows: (input.documentVersions ?? []).map(v => [faNum(v.Version), esc(v.Format), esc(v.Status), esc(v.GeneratedBy ?? '—'), faDate(v.GeneratedAt)]) },
  };

  const chapterIntro: Record<number, string> = {
    3: 'این لایحه بر مبنای داده‌های واقعی پرونده، محاسبات نسخه‌دار و اسناد EDMS پیوندشده تولید شده است؛ هرجا محاسبهٔ تأییدشده یا مدرک کافی نیست، «—» و «نیازمند بررسی کارشناسی» درج شده است.',
    11: 'مدت تأخیر، مدت تمدید قابل استحقاق و مبلغ خسارت سه خروجی متفاوت‌اند و جداگانه گزارش شده‌اند.',
    12: 'محاسبات زمانی از نتایج تأییدشدهٔ بخشنامه‌های ۱۳۰۰/۵۰۹۰ ماژول تأخیرات خوانده می‌شود؛ فرمول در دو ماژول تکرار نشده است.',
    15: 'فرضیات هر محاسبه در اجرای مربوط ثبت و قابل بازتولید است.',
    17: 'نتیجهٔ بررسی کارشناسی پس از تأیید مسئول مربوط در سامانه ثبت می‌شود؛ این سند تا آن زمان پیش‌نویس است.',
  };

  const parts: string[] = [];
  for (const chapter of LOSS_DOC_CHAPTERS) {
    const tables = LOSS_DOC_TABLES.filter(t => t.chapter === chapter.no);
    const body = [
      chapter.no === 1 ? `<div class="cover"><h1>لایحهٔ ضرر و زیان پیمان</h1><p>پرونده: <b>${esc(claim.Code)}</b> — ${esc(claim.TitleFa)}</p><p>وضعیت سند: <b>پیش‌نویس</b></p></div>` : '',
      chapterIntro[chapter.no] ? `<p>${esc(chapterIntro[chapter.no])}</p>` : '',
      ...tables.map(t => `<h3>جدول ${t.no} ـ ${esc(t.fa)} [الزامی]</h3>` + table(D[t.dataset]?.heads ?? ['مورد'], D[t.dataset]?.rows ?? [])),
    ].join('\n');
    parts.push(`<h2>فصل ${chapter.no} ـ ${esc(chapter.fa)}</h2>${body}`);
  }
  // راهنمای داخلی تولید سند؛ در خروجی رسمی با Auto-Cleanup حذف می‌شود.
  parts.push('<section data-internal="true"><h2>راهنمای داخلی تنظیم لایحه</h2><p>راهنمای داخلی: این بخش فقط برای تنظیم‌کننده است و نباید در نسخهٔ صادرشده بماند. [اختیاری]</p></section>');

  const rawBody = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>لایحه ضرر و زیان ${esc(claim.Code)}</title>
<style>@page{size:A4;margin:18mm}body{font-family:'B Nazanin',Tahoma,sans-serif;font-size:12pt;line-height:1.9;color:#111}h1{font-size:19pt}h2{font-size:14pt;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin-top:22px}h3{font-size:12pt;color:#1f4e79}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #666;padding:5px 7px;font-size:10.5pt;text-align:right;vertical-align:top}th{background:#dbe7f3}.cover{border:2px solid #1f4e79;padding:24px;text-align:center;margin-top:60px}</style></head>
<body>${parts.join('\n')}</body></html>`;

  const finalize = (html: string): string => sanitizeLossDocumentHtml(
    html.replace('</head>', `<style>body{font-family:'B Nazanin',Tahoma,sans-serif}table td,table th{font-family:inherit}</style></head>`),
  );
  return { body: finalize(rawBody), issues, filename: `LossClaim-${String(claim.Code ?? 'claim')}-v${input.version}.${input.format === 'pdf' ? 'html' : 'doc'}`, contentType: 'application/msword; charset=utf-8' };
}
